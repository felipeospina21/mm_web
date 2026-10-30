import type { TableData } from "../_components/types";
import { LINE_ITEM_COLS } from "./line-items";

export interface Cell {
  row: number;
  col: number;
}

/**
 * Find the next editable cell when Tab-navigating a table, wrapping across
 * rows and from the last cell back to the first. For line-items tables the
 * computed subtotal column is skipped (it is never directly editable).
 *
 * Returns `null` when no editable target exists (e.g. every candidate is the
 * skipped subtotal column), matching the hook's "stay put" behaviour.
 */
export function nextEditableCell(
  table: TableData,
  current: Cell,
  isLineItemsTable: boolean,
): Cell | null {
  const cellCount = table.cells.reduce((count, row) => count + row.length, 0);
  let nextRow = current.row;
  let nextCol = current.col;
  for (let step = 0; step < cellCount; step += 1) {
    nextCol += 1;
    if (nextCol >= table.colWidths.length) {
      nextRow += 1;
      nextCol = 0;
    }
    if (nextRow >= table.cells.length) {
      nextRow = 0;
      nextCol = 0;
    }
    if (!(isLineItemsTable && nextCol === LINE_ITEM_COLS.subtotal)) {
      return { row: nextRow, col: nextCol };
    }
  }
  return null;
}
