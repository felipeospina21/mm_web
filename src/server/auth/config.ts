import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { verify } from "argon2";
import { sql } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";

const drizzleAdapter = DrizzleAdapter(db, {
  usersTable: users,
  // Auth.js account payloads use snake_case OAuth field names. The app schema
  // exposes camelCase properties, so linkAccount below maps between them.
  accountsTable: accounts as never,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

const adapter = {
  ...drizzleAdapter,
  async linkAccount(
    account: Parameters<NonNullable<typeof drizzleAdapter.linkAccount>>[0],
  ) {
    await db.insert(accounts).values({
      userId: account.userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      refreshToken: account.refresh_token ?? null,
      accessToken: account.access_token ?? null,
      expiresAt: account.expires_at ?? null,
      tokenType: account.token_type ?? null,
      scope: account.scope ?? null,
      idToken: account.id_token ?? null,
      sessionState:
        typeof account.session_state === "string"
          ? account.session_state
          : null,
    });
  },
};

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers:
    env.NODE_ENV === "development"
      ? [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const email = credentials.email;
              const password = credentials.password;
              if (typeof email !== "string" || typeof password !== "string") {
                return null;
              }

              const [user] = await db
                .select({
                  id: users.id,
                  name: users.name,
                  email: users.email,
                  passwordHash: users.passwordHash,
                })
                .from(users)
                .where(sql`lower(${users.email}) = lower(${email})`)
                .limit(1);

              if (!user?.passwordHash) return null;
              if (!(await verify(user.passwordHash, password))) return null;

              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : [
          MicrosoftEntraID({
            clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
            // Existing users are linked by their tenant-verified email, preserving
            // their user IDs and all owned records. Entra must emit email and
            // xms_edov claims (see .env.example setup notes).
            allowDangerousEmailAccountLinking: true,
            profile(profile) {
              if (!profile.email || profile.xms_edov !== true) {
                throw new Error(
                  "Microsoft did not provide a verified email address.",
                );
              }
              return {
                id: profile.sub,
                name: profile.name,
                email: profile.email,
                image: null,
              };
            },
          }),
        ],
  adapter,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
  },
} satisfies NextAuthConfig;
