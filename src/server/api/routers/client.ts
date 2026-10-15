import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { clients } from "@/server/db/schema";

const clientInput = z.object({
  name: z.string().trim().min(1).max(256),
  companyId: z.string().trim().max(255).optional(),
  address: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(32).optional(),
  contactName: z.string().trim().max(256).optional(),
  contactPhone: z.string().trim().max(32).optional(),
  contactEmail: z.string().trim().email().max(255).or(z.literal("")).optional(),
});

const nullableText = (value: string | undefined) =>
  value?.trim() ? value.trim() : null;

export const clientRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: clients.id,
        name: clients.name,
        companyId: clients.companyId,
        address: clients.address,
        phone: clients.phone,
        contactName: clients.contactName,
        contactPhone: clients.contactPhone,
        contactEmail: clients.contactEmail,
      })
      .from(clients)
      .where(eq(clients.userId, ctx.session.user.id))
      .orderBy(asc(clients.name)),
  ),

  create: protectedProcedure
    .input(clientInput)
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .insert(clients)
        .values({
          ...input,
          companyId: nullableText(input.companyId),
          address: nullableText(input.address),
          phone: nullableText(input.phone),
          contactName: nullableText(input.contactName),
          contactPhone: nullableText(input.contactPhone),
          contactEmail: nullableText(input.contactEmail),
          userId: ctx.session.user.id,
        })
        .returning({
          id: clients.id,
          name: clients.name,
          companyId: clients.companyId,
          address: clients.address,
          phone: clients.phone,
          contactName: clients.contactName,
          contactPhone: clients.contactPhone,
          contactEmail: clients.contactEmail,
        });

      return client!;
    }),
});
