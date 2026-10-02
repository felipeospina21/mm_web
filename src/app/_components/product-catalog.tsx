'use client'

import { useEffect, useRef } from 'react'

import { api } from '@/trpc/react'
import { ProductCard, type CatalogProduct } from './product-card'

/** Number of products fetched per page. */
const PAGE_SIZE = 12

/**
 * Product grid with infinite scroll: renders the first page on mount and
 * fetches the next page whenever the sentinel at the bottom of the grid
 * scrolls into view.
 */
export function ProductCatalog() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = api.product.list.useInfiniteQuery(
    { limit: PAGE_SIZE },
    {
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextOffset : undefined,
    },
  )

  const products: CatalogProduct[] =
    data?.pages.flatMap((page) => page.items) ?? []

  // Infinite scroll: observe a sentinel below the grid and fetch the next
  // page when it (or the 200px margin around it) enters the viewport.
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

  if (status === 'pending') {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#1f4e79]" />
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Sentinel for the IntersectionObserver. */}
      <div ref={sentinelRef} aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="flex justify-center pb-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-[#1f4e79]" />
        </div>
      )}

      {!hasNextPage && (
        <p className="pb-10 text-center text-sm text-neutral-400">
          You&rsquo;ve reached the end of the catalog
        </p>
      )}
    </>
  )
}
