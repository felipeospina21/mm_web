"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/trpc/react";
import { setPendingQuotationLoad } from "@/lib/quotation-load";
import { defaultLocale, intlLocale, t } from "@/i18n/messages";

const PAGE_SIZE = 12;

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(intlLocale(defaultLocale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Paginated list of the user's quotations with infinite scroll (same
 * pattern as the product catalog). Clicking a card stashes the quotation
 * id for the editor and navigates there.
 */
export function QuotationList() {
  const router = useRouter();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    api.quotation.list.useInfiniteQuery(
      { limit: PAGE_SIZE },
      {
        getNextPageParam: (lastPage) =>
          lastPage.hasMore ? lastPage.nextOffset : undefined,
      },
    );

  const quotations = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleOpen = (id: string) => {
    setPendingQuotationLoad(id);
    router.push("/editor");
  };

  if (status === "pending") {
    return (
      <div className="flex justify-center py-20">
        <div className="border-t-primary h-8 w-8 animate-spin rounded-full border-2 border-neutral-300" />
      </div>
    );
  }

  if (quotations.length === 0) {
    return (
      <p className="py-20 text-center text-neutral-500">
        {t("quotations.empty")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">
        {t("quotations.title")}{" "}
        <span className="text-sm font-normal text-neutral-400">({total})</span>
      </h1>

      <ul className="flex flex-col gap-3">
        {quotations.map((q) => (
          <li key={q.id}>
            <button
              onClick={() => handleOpen(q.id)}
              className="hover:border-primary flex w-full items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm transition hover:shadow"
            >
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="bg-primary rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                    {q.quotationNumber}
                  </span>
                  <span className="font-semibold text-neutral-900">
                    {q.clientName ?? t("client.none")}
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  {t("quotations.createdUpdated", {
                    created: formatDate(q.createdDate),
                    updated: formatDate(q.updatedDate),
                  })}
                </span>
                {q.userName && (
                  <span className="text-xs text-neutral-500">{q.userName}</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-neutral-500">
                  {t(
                    q.productCount === 1
                      ? "quotations.productOne"
                      : "quotations.productMany",
                    {
                      count: q.productCount,
                    },
                  )}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <div className="border-t-primary h-6 w-6 animate-spin rounded-full border-2 border-neutral-300" />
        </div>
      )}
    </div>
  );
}
