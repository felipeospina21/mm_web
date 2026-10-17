import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { clientContacts, clients, users } from "@/server/db/schema";

const contactInput = z.object({
  name: z.string().trim().min(1).max(256),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(255).or(z.literal("")).optional(),
});

const clientInput = z.object({
  name: z.string().trim().min(1).max(256),
  companyId: z.string().trim().max(255).optional(),
  address: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(32).optional(),
  contacts: z.array(contactInput).default([]),
});

const nullableText = (value: string | undefined) =>
  value?.trim() ? value.trim() : null;

export const clientRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const clientRows = await ctx.db
      .select({
        id: clients.id,
        name: clients.name,
        companyId: clients.companyId,
        userAlias: users.alias,
        address: clients.address,
        phone: clients.phone,
      })
      .from(clients)
      .innerJoin(users, eq(clients.userId, users.id))
      .orderBy(asc(clients.name));
    if (clientRows.length === 0) return [];

    const contactRows = await ctx.db
      .select({
        id: clientContacts.id,
        clientId: clientContacts.clientId,
        name: clientContacts.name,
        phone: clientContacts.phone,
        email: clientContacts.email,
      })
      .from(clientContacts)
      .where(
        inArray(
          clientContacts.clientId,
          clientRows.map(({ id }) => id),
        ),
      )
      .orderBy(asc(clientContacts.name));
    const contactsByClient = new Map<string, typeof contactRows>();
    for (const contact of contactRows) {
      const clientContactsList = contactsByClient.get(contact.clientId) ?? [];
      clientContactsList.push(contact);
      contactsByClient.set(contact.clientId, clientContactsList);
    }

    return clientRows.map((client) => ({
      ...client,
      contacts: contactsByClient.get(client.id) ?? [],
    }));
  }),

  create: protectedProcedure
    .input(clientInput)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const [owner] = await tx
          .select({ userAlias: users.alias })
          .from(users)
          .where(eq(users.id, ctx.session.user.id))
          .limit(1);
        const [client] = await tx
          .insert(clients)
          .values({
            name: input.name,
            companyId: nullableText(input.companyId),
            address: nullableText(input.address),
            phone: nullableText(input.phone),
            userId: ctx.session.user.id,
          })
          .returning({
            id: clients.id,
            name: clients.name,
            companyId: clients.companyId,
            address: clients.address,
            phone: clients.phone,
          });

        const createdContacts =
          input.contacts.length > 0
            ? await tx
                .insert(clientContacts)
                .values(
                  input.contacts.map((contact) => ({
                    clientId: client!.id,
                    name: contact.name,
                    phone: nullableText(contact.phone),
                    email: nullableText(contact.email),
                  })),
                )
                .returning({
                  id: clientContacts.id,
                  clientId: clientContacts.clientId,
                  name: clientContacts.name,
                  phone: clientContacts.phone,
                  email: clientContacts.email,
                })
            : [];

        return {
          ...client!,
          userAlias: owner?.userAlias ?? null,
          contacts: createdContacts,
        };
      }),
    ),
});
