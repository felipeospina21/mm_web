import { useEffect, useRef } from "react";

interface UseInfiniteScrollSentinelOptions {
  /** Whether another page exists to fetch. */
  hasNextPage: boolean;
  /** Whether a page fetch is already in flight (prevents duplicate fetches). */
  isFetchingNextPage: boolean;
  /** Fetches the next page when the sentinel scrolls into view. */
  fetchNextPage: () => unknown;
  /**
   * Distance from the viewport at which to start fetching. Defaults to
   * `"200px"` so the next page loads just before the sentinel is visible.
   */
  rootMargin?: string;
}

/**
 * Observes a sentinel element and fetches the next page when it (plus
 * `rootMargin`) enters the viewport. Attach the returned ref to a node at the
 * bottom of the scrollable list.
 *
 * Extracted from the product catalog and the quotations list, which shared an
 * identical IntersectionObserver effect (see editor-improvements-plan 5.7).
 */
export function useInfiniteScrollSentinel<T extends Element = HTMLDivElement>({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = "200px",
}: UseInfiniteScrollSentinelOptions) {
  const sentinelRef = useRef<T | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin]);

  return sentinelRef;
}
