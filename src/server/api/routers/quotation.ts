import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { type QuotationDocument } from "@/app/editor/_components/types";
import { canAccessAllQuotations } from "@/server/auth/access";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { quotations } from "@/server/db/schema";

/**
 * The quotation document ({ meta, pages }) is validated structurally: it must
 * be an object with a `meta` object and a `pages` array. The rich element
 * shapes are already type-checked on the client via the shared
 * QuotationDocument type, so we accept the structured object (typed via
 * z.custom) and store it as JSONB. Tightening into a full element schema can
 * come later if untrusted clients ever write to it.
 */
const quotationDocument = z.custom<QuotationDocument>(
  (val) =>
    typeof val === "object" &&
    val !== null &&
    "meta" in val &&
    "pages" in val &&
    Array.isArray((val as { pages: unknown }).pages),
  { message: "Invalid quotation document" },
);

const saveInput = z.object({
  /** Present when updating an already-saved quotation; absent on first save. */
  id: z.string().uuid().optional(),
  clientName: z.string().min(1).max(256),
  /** Optional external CRM client id. */
  clientId: z.string().max(255).optional(),
  /** Product reference codes included in this quotation. */
  references: z.array(z.string()).optional(),
  data: quotationDocument,
});

const listInput = z.object({
  /** Page size. Defaults to 12, capped at 50. */
  limit: z.number().int().min(1).max(50).default(12),
  /** Offset-based cursor; undefined on the first page. */
  cursor: z.number().int().min(0).optional(),
});

/** Parse a formatted price string like "$12,500.00" into a number. */
function parsePrice(price: string): number {
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Derive product_count and total (as a numeric string) from the document. */
function deriveTotals(doc: QuotationDocument): {
  productCount: number;
  total: string;
} {
  const products = doc.meta?.products ?? [];
  const total = products.reduce((sum, p) => sum + parsePrice(p.price), 0);
  return { productCount: products.length, total: total.toFixed(2) };
}

export const quotationRouter = createTRPCRouter({
  /**
   * Save (create or update) a quotation.
   *
   * Race safety: the sequential `quotation_number` is a Postgres `serial`
   * (sequence-backed) with a UNIQUE constraint. On first save we INSERT and
   * let the database assign the number atomically via the sequence, reading
   * it back with RETURNING. We never compute `max(number)+1` in app code, so
   * concurrent first-saves from different users can never collide on a
   * number — the sequence hands out distinct values and UNIQUE is the
   * backstop. Subsequent saves UPDATE the same row by id (number unchanged),
   * scoped to the owner.
   */
  save: protectedProcedure
    .input(saveInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { productCount, total } = deriveTotals(input.data);

      // Existing quotation: update in place (keeps its quotation_number).
      if (input.id) {
        const [updated] = await ctx.db
          .update(quotations)
          .set({
            clientName: input.clientName,
            clientId: input.clientId ?? null,
            references: input.references ?? null,
            data: input.data,
            productCount,
            total,
            updatedDate: new Date(),
          })
          .where(and(eq(quotations.id, input.id), eq(quotations.userId, userId)))
          .returning({
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
          });

        if (!updated) {
          // No row matched id + owner → either not found or not theirs.
          throw new Error("Quotation not found or not owned by current user");
        }
        return updated;
      }

      // New quotation: INSERT; the DB sequence assigns quotation_number.
      const [created] = await ctx.db
        .insert(quotations)
        .values({
          clientName: input.clientName,
          clientId: input.clientId ?? null,
          references: input.references ?? null,
          userId,
          data: input.data,
          productCount,
          total,
        })
        .returning({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
        });

      return created!;
    }),

  /**
   * Paginated list of quotations for the "My Quotations" page.
   *
   * Visibility is enforced via `canAccessAllQuotations`: admins (future) see
   * every quotation; regular users see only their own. Returns scalar fields
   * only — the heavy `data` JSONB is intentionally excluded so listing stays
   * cheap. Ordered by most-recently-updated first.
   */
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const offset = input.cursor ?? 0;
    const seeAll = canAccessAllQuotations(ctx.session);
    const ownerFilter = seeAll
      ? undefined
      : eq(quotations.userId, ctx.session.user.id);

    const [items, total] = await Promise.all([
      ctx.db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          clientName: quotations.clientName,
          productCount: quotations.productCount,
          total: quotations.total,
          createdDate: quotations.createdDate,
          updatedDate: quotations.updatedDate,
        })
        .from(quotations)
        .where(ownerFilter)
        .orderBy(desc(quotations.updatedDate))
        .limit(input.limit)
        .offset(offset),
      ctx.db.select({ value: count() }).from(quotations).where(ownerFilter),
    ]);

    const totalCount = total[0]?.value ?? 0;

    return {
      items,
      total: totalCount,
      hasMore: offset + items.length < totalCount,
      nextOffset: offset + items.length,
    };
  }),

  /**
   * Fetch one quotation (full row incl. `data`) to load into the editor.
   * Ownership-enforced via `canAccessAllQuotations`. Returns null when the
   * quotation doesn't exist or the caller may not access it.
   */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.quotations.findFirst({
        where: (q, { eq: eqOp }) => eqOp(q.id, input.id),
      });

      if (!row) return null;

      const seeAll = canAccessAllQuotations(ctx.session);
      if (!seeAll && row.userId !== ctx.session.user.id) {
        return null;
      }

      return row;
    }),
});
