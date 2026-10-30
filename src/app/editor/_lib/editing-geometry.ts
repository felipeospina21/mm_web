import type { EditingBox } from "../_components/inline-text-editor";

/**
 * Vertical position of an inline-edit overlay in *content space* — the `top`
 * it would have if the canvas were not scrolled. Callers subtract the live
 * scroll offset (see {@link computeEditingBox}) so the overlay tracks its cell.
 *
 * For a table cell, pass `row` + `rowHeight` to offset down to that row.
 */
export function computeContentTop(input: {
  stageTop: number;
  offsetY: number;
  elementY: number;
  row?: number;
  rowHeight?: number;
}): number {
  const { stageTop, offsetY, elementY, row = 0, rowHeight = 0 } = input;
  return stageTop + offsetY + elementY + row * rowHeight;
}

/**
 * Screen-space box for the inline-edit overlay. `top` is `contentTop` minus the
 * live `scrollTop`. For a table cell, pass `colWidths` + `col` so the box is
 * offset by the sum of the preceding column widths.
 */
export function computeEditingBox(input: {
  stageLeft: number;
  offsetX: number;
  elementX: number;
  contentTop: number;
  scrollTop: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  colWidths?: number[];
  col?: number;
}): EditingBox {
  const {
    stageLeft,
    offsetX,
    elementX,
    contentTop,
    scrollTop,
    width,
    height,
    fontSize,
    color,
    colWidths,
    col = 0,
  } = input;
  const colOffset =
    colWidths && col > 0
      ? colWidths.slice(0, col).reduce((a, b) => a + b, 0)
      : 0;
  return {
    left: stageLeft + offsetX + elementX + colOffset,
    top: contentTop - scrollTop,
    width,
    height,
    fontSize,
    color,
  };
}
