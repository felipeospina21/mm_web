import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const productRouter = createTRPCRouter({
  /**
   * Full product catalog for the home page: each product with its
   * color variants (stock + packaging info).
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const products = await ctx.db.query.products.findMany({
      with: {
        variants: true,
      },
      orderBy: (products, { asc }) => [asc(products.createdAt)],
    });

    return products;
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
