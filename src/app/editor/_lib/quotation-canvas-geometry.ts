import { PAGE_GAP, PAGE_HEIGHT } from "../_components/types";

/** Computes the absolute top-left position of a page on the stage. */
export function getPageOffset(pageNumber: number): { x: number; y: number } {
  return {
    x: 40,
    y: 40 + (pageNumber - 1) * (PAGE_HEIGHT + PAGE_GAP),
  };
}
