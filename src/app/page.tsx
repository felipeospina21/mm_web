import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { LoginScreen } from "./_components/login-screen";
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

  if (!session?.user) return <LoginScreen />;

  return (
    <main className="min-h-screen bg-neutral-100">
      <ReferenceLookup />
    </main>
  );
}
