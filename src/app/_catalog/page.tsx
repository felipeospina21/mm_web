import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

import { ProductCatalog } from "../_components/product-catalog";
import { QuotationBar } from "../_components/quotation-bar";
import { t } from "@/i18n/messages";

/**
 * Hidden product catalog.
 *
 * The POC's primary flow is now the reference-lookup home (`/`), which
 * resolves SKUs against the external API. The original browse-and-pick
 * catalog is intentionally preserved here on an unlinked `/catalog` route
 * (reachable by URL only, not shown in the nav) so we can revisit it later.
 * It still writes picked products to the same sessionStorage selection the
 * editor consumes, so the catalog → editor handoff is unchanged.
 */

/**
 * Must match PAGE_SIZE in product-catalog.tsx so the server-prefetched
 * first page and the client's useInfiniteQuery share the same query key.
 */
const PAGE_SIZE = 12;

export default async function CatalogPage() {
  const session = await auth();

  // Hidden route: signed-out visitors are sent to the public home rather
  // than shown a login form here.
  if (!session?.user) redirect("/");

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
          {t("catalog.title")}
        </h1>
        <span className="text-sm text-neutral-500">
          {t("catalog.subtitle")}
        </span>
      </header>

      <HydrateClient>
        <ProductCatalog />
      </HydrateClient>

      <QuotationBar />
    </main>
  );
}
