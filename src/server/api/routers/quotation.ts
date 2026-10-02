import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { type QuotationDocument } from "@/app/editor/_components/types";
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

      // Existing quotation: update in place (keeps its quotation_number).
      if (input.id) {
        const [updated] = await ctx.db
          .update(quotations)
          .set({
            clientName: input.clientName,
            clientId: input.clientId ?? null,
            references: input.references ?? null,
            data: input.data,
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
        })
        .returning({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
        });

      return created!;
    }),
});
