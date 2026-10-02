import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { api, HydrateClient } from "@/trpc/server";

import { QuotationList } from "../_components/quotation-list";

/** Must match PAGE_SIZE in quotation-list.tsx so query keys line up. */
const PAGE_SIZE = 12;

export default async function MyQuotationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  // Server-prefetch the first page into the QueryClient cache; the client's
  // useInfiniteQuery hydrates from this and fetches more on scroll.
  void api.quotation.list.prefetchInfinite(
    { limit: PAGE_SIZE },
    {
      pages: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextOffset : undefined,
    },
  );

  return (
    <main className="min-h-screen bg-neutral-100">
      <HydrateClient>
        <QuotationList />
      </HydrateClient>
    </main>
  );
}
