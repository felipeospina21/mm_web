'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { api } from '@/trpc/react'
import { setPendingQuotationLoad } from '@/lib/quotation-load'

const PAGE_SIZE = 12

/** COP currency formatter for quotation totals. */
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Paginated list of the user's quotations with infinite scroll (same
 * pattern as the product catalog). Clicking a card stashes the quotation
 * id for the editor and navigates there.
 */
export function QuotationList() {
  const router = useRouter()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    api.quotation.list.useInfiniteQuery(
      { limit: PAGE_SIZE },
      {
        getNextPageParam: (lastPage) =>
          lastPage.hasMore ? lastPage.nextOffset : undefined,
      },
    )

  const quotations = data?.pages.flatMap((page) => page.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleOpen = (id: string) => {
    setPendingQuotationLoad(id)
    router.push('/editor')
  }

  if (status === 'pending') {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#1f4e79]" />
      </div>
    )
  }

  if (quotations.length === 0) {
    return (
      <p className="py-20 text-center text-neutral-500">
        You don&rsquo;t have any saved quotations yet.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">
        My Quotations{' '}
        <span className="text-sm font-normal text-neutral-400">({total})</span>
      </h1>

      <ul className="flex flex-col gap-3">
        {quotations.map((q) => (
          <li key={q.id}>
            <button
              onClick={() => handleOpen(q.id)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#1f4e79] hover:shadow"
            >
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-[#1f4e79] px-2 py-0.5 text-xs font-semibold text-white">
                    #{q.quotationNumber}
                  </span>
                  <span className="font-semibold text-neutral-900">
                    {q.clientName}
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  Created {formatDate(q.createdDate)} · Updated{' '}
                  {formatDate(q.updatedDate)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold text-neutral-900">
                  {copFormatter.format(Number(q.total))}
                </span>
                <span className="text-xs text-neutral-500">
                  {q.productCount}{' '}
                  {q.productCount === 1 ? 'product' : 'products'}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[#1f4e79]" />
        </div>
      )}
    </div>
  )
}
