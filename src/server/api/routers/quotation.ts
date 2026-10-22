import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { type PageData } from "@/app/editor/_components/types";
import { canAccessAllQuotations } from "@/server/auth/access";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { clients, quotations, users } from "@/server/db/schema";

const quotationPages = z.custom<PageData[]>(Array.isArray, {
  message: "Quotation pages must be an array",
});

const saveInput = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  data: quotationPages,
});

const listInput = z.object({
  limit: z.number().int().min(1).max(50).default(12),
  cursor: z.number().int().min(0).optional(),
});

function derivePageFields(pages: PageData[]) {
  const productPages = pages.filter((page) =>
    page.elements.some((element) => element.id.startsWith("product-name-")),
  );
  const references = productPages.flatMap((page) => {
    const element = page.elements.find((item) =>
      item.id.startsWith("product-reference-"),
    );
    const reference = element?.text.split(":").at(-1)?.trim();
    return reference ? [reference] : [];
  });

  return { productCount: productPages.length, references };
}

/** Store the database-assigned number in the canvas pages. */
function setQuotationNumber(pages: PageData[], quotationNumber: string) {
  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) =>
      element.id === "quotation-number"
        ? {
            ...element,
            text: element.text.includes("{{quotationNumber}}")
              ? element.text.replace(
                  /\{\{quotationNumber\}\}/g,
                  quotationNumber,
                )
              : /M?\d+\s*$/.test(element.text)
                ? element.text.replace(/M?\d+\s*$/, quotationNumber)
                : `${element.text.trimEnd()} ${quotationNumber}`,
          }
        : element,
    ),
  }));
}

export const quotationRouter = createTRPCRouter({
  representative: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        name: users.name,
        email: users.email,
        phone: users.phone,
        phoneExt: users.phoneExt,
        cellphone: users.cellphone,
      })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    return user ?? null;
  }),

  save: protectedProcedure.input(saveInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const clientId = input.clientId;
    let clientName: string | null = null;
    const [client] = await ctx.db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
      .limit(1);

    if (!client) {
      throw new Error(
        "El cliente no pertence al comercial o no existe en la BD",
      );
    }
    clientName = client.name;

    const { productCount, references } = derivePageFields(input.data);
    if (input.id) {
      const quotationId = input.id;
      return ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(quotations)
          .set({
            clientId,
            references,
            data: input.data,
            productCount,
            updatedDate: new Date(),
          })
          .where(
            and(eq(quotations.id, quotationId), eq(quotations.userId, userId)),
          )
          .returning({
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
          });

        if (!updated)
          throw new Error(
            "La cotización no existe o no pertenece al comercial",
          );

        const data = setQuotationNumber(input.data, updated.quotationNumber);
        await tx
          .update(quotations)
          .set({ data })
          .where(eq(quotations.id, updated.id));
        return { ...updated, clientId, clientName, data };
      });
    }

    return ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(quotations)
        .values({
          clientId,
          references,
          userId,
          data: input.data,
          productCount,
        })
        .returning({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
        });

      const data = setQuotationNumber(input.data, created!.quotationNumber);
      await tx
        .update(quotations)
        .set({ data })
        .where(eq(quotations.id, created!.id));
      return { ...created!, clientId, clientName, data };
    });
  }),

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
          clientName: clients.name,
          userName: users.name,
          productCount: quotations.productCount,
          createdDate: quotations.createdDate,
          updatedDate: quotations.updatedDate,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(users, eq(quotations.userId, users.id))
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

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.quotations.findFirst({
        where: (quotation, { eq: eqOp }) => eqOp(quotation.id, input.id),
      });
      if (!row) return null;

      const seeAll = canAccessAllQuotations(ctx.session);
      if (!seeAll && row.userId !== ctx.session.user.id) return null;
      return row;
    }),
});
