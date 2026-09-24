// Type-only re-export of the tRPC AppRouter.
//
// Client components (e.g. src/trpc/react.tsx) need the AppRouter *type* for
// end-to-end type inference, but must never pull the router's server runtime
// (postgres, argon2, next-auth) into the browser bundle. `import type` here is
// erased at emit (verbatimModuleSyntax), and giving the client a dedicated
// type-only specifier keeps Turbopack from tracing the runtime module graph
// into the client bundle.
import type { appRouter } from "@/server/api/root";

export type AppRouter = typeof appRouter;
