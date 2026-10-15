import { auth } from "@/server/auth";

import { LoginForm } from "./_components/login-form";
import { ReferenceLookup } from "./_components/reference-lookup";

/**
 * Home page.
 *
 * Signed out → the login form. Signed in → the reference-lookup view: paste a
 * comma-separated list of SKUs, resolve them against the external product API,
 * and load the matches into the quotation editor. (The original product
 * catalog is preserved on the hidden `/catalog` route.)
 */
export default async function Home() {
  const session = await auth();

  // Not signed in — show the login form.
  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-(--color-primary) to-(--color-secondary) px-4">
        <LoginForm />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100">
      <ReferenceLookup />
    </main>
  );
}
