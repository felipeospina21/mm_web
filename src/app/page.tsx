import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

import { LoginForm } from "./_components/login-form";
import { ProductCatalog } from "./_components/product-catalog";
import { QuotationBar } from "./_components/quotation-bar";

/**
 * Must match PAGE_SIZE in product-catalog.tsx so the server-prefetched
 * first page and the client's useInfiniteQuery share the same query key.
 */
const PAGE_SIZE = 12;

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

  // Server-side fetch of the first page into the QueryClient cache. The
  // client's useInfiniteQuery hydrates from this and only fetches
  // subsequent pages on scroll. `pages: 1` limits the server fetch to the
  // first page; `getNextPageParam` must match the client's so the query
  // keys line up.
  void api.product.list.prefetchInfinite(
    { limit: PAGE_SIZE },
    {
      pages: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextOffset : undefined,
    },
  );

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <h1 className="text-lg font-semibold text-neutral-900">
          Product Catalog
        </h1>
        <span className="text-sm text-neutral-500">
          Pick products to build your quotation
        </span>
      </header>

      <HydrateClient>
        <ProductCatalog />
      </HydrateClient>

      <QuotationBar />
    </main>
  );
}
