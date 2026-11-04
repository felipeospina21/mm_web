/**
 * Page numbers to render: the scroll-visible window plus the active page.
 *
 * The active page stays mounted even when scrolled out of the window so its
 * selected element's node (and the transformer attached to it) stays alive.
 * Returns the same `visible` set when it already contains the active page, so
 * memoized consumers keep a stable reference.
 */
export function withActivePage(
  visible: ReadonlySet<number>,
  activePageNumber: number,
): ReadonlySet<number> {
  if (visible.has(activePageNumber)) return visible;
  return new Set(visible).add(activePageNumber);
}
