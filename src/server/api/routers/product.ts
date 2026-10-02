import { count } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
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
});
