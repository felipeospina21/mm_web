import { PAGE_HEIGHT, PAGE_WIDTH } from "../_components/types";
import { getPageOffset } from "./quotation-canvas-geometry";

/** Inputs needed to clamp a dragged element inside its page. */
export interface DragBoundsInput {
  /** 1-based page number the element belongs to. */
  pageNumber: number;
  /** Element width in px (the draggable box width). */
  width: number;
  /** Element height in px. */
  height: number;
  /** Current vertical scroll offset of the canvas container, in px. */
  scrollTop: number;
}

/**
 * Clamp a proposed drag position so the element stays within the bounds of its
 * page. Pure: all page geometry is derived from `pageNumber` + the fixed page
 * constants, and the live scroll offset is passed in (not read from a ref) so
 * the function is deterministic and unit-testable.
 *
 * Konva's `dragBoundFunc` works in absolute/stage coordinates; `scrollTop`
 * converts the page's document-space top into its on-screen (visible) top.
 */
export function clampToPageBounds(
  pos: { x: number; y: number },
  { pageNumber, width, height, scrollTop }: DragBoundsInput,
): { x: number; y: number } {
  const pageOffset = getPageOffset(pageNumber);
  const visiblePageY = pageOffset.y - scrollTop;
  return {
    x: Math.min(
      Math.max(pos.x, pageOffset.x),
      pageOffset.x + PAGE_WIDTH - width,
    ),
    y: Math.min(
      Math.max(pos.y, visiblePageY),
      visiblePageY + PAGE_HEIGHT - height,
    ),
  };
}
