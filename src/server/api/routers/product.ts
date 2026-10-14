import { count } from "drizzle-orm";
import { z } from "zod";

import { MAX_REFERENCES } from "@/lib/references";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { resolveSkus } from "@/server/external/resolve";
import { products } from "@/server/db/schema";

const listInput = z.object({
  /** Page size. Defaults to 12, capped at 50. */
  limit: z.number().int().min(1).max(50).default(12),
  /**
   * Number of products to skip (offset-based cursor). `undefined` on the
   * first page; tRPC's useInfiniteQuery feeds getNextPageParam's return
   * value back in here as the next cursor.
   */
  cursor: z.number().int().min(0).optional(),
});

/**
 * Input for the SKU lookup. The raw strings are trimmed, emptied-out and
 * de-duplicated (case-insensitively, keeping first-seen casing) before the
 * length cap is applied, mirroring `parseReferences` on the client so the two
 * agree on what "the list" is.
 */
const resolveInput = z.object({
  references: z
    .array(z.string())
    .transform((refs) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const r of refs) {
        const sku = r.trim();
        if (!sku) continue;
        const key = sku.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(sku);
      }
      return out;
    })
    .pipe(z.array(z.string()).max(MAX_REFERENCES)),
});

export const productRouter = createTRPCRouter({
  /**
   * Paginated product catalog for the home page: each product with its
   * color variants (stock + packaging info).
   *
   * Returns the page of products plus pagination metadata so the client
   * can drive infinite scroll.
   */
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const offset = input.cursor ?? 0;

    const [items, total] = await Promise.all([
      ctx.db.query.products.findMany({
        with: {
          variants: true,
        },
        orderBy: (products, { asc }) => [asc(products.createdAt)],
        limit: input.limit,
        offset,
      }),
      ctx.db.select({ value: count() }).from(products),
    ]);

    const totalCount = total[0]?.value ?? 0;

    return {
      items,
      total: totalCount,
      hasMore: offset + items.length < totalCount,
      nextOffset: offset + items.length,
    };
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (products, { eq }) => eq(products.id, input.id),
        with: { variants: true },
      });

      return product ?? null;
    }),

  /**
   * Resolve a list of product references (SKUs) against the external product
   * API and return them as clean {@link QuotationProduct}s ready to load into
   * the quotation editor.
   *
   * This is the heart of the reference-lookup flow: it wires the external API
   * client (batched `?skus=` fetch) to the Zod firewall (normalization) and
   * splits the outcome into `resolved` + `unresolved` so the UI can show which
   * codes were found and let the user proceed with the ones that were.
   *
   * A requested SKU is `unresolved` when the API returned no product for it,
   * OR when the returned payload was too malformed to normalize. Matching is
   * case-insensitive (the API echoes a product-level `sku` that we align with
   * the requested casing). The returned product carries the API's canonical
   * `reference`, not necessarily the user's exact casing.
   */
  resolveReferences: protectedProcedure
    .input(resolveInput)
    .query(async ({ input }) => {
      return resolveSkus(input.references);
    }),
});
