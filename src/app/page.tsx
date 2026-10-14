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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4">
        <LoginForm />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <h1 className="text-lg font-semibold text-neutral-900">
          New quotation
        </h1>
        <span className="text-sm text-neutral-500">
          Look up products by reference to start a quotation
        </span>
      </header>

      <ReferenceLookup />
    </main>
  );
}
