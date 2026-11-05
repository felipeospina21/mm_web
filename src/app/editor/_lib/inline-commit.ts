import type { TemplateElement } from "../_components/types";
import { isLineItems } from "./element-role";
import { formatEditedCell, setLineItemSubtotal } from "./line-items";

/**
 * Patch builders for committing an inline (textarea) edit back to an element.
 *
 * Each returns `null` when the commit would not change the element. Callers
 * then skip `onElementChange`, so opening an editor and closing it without a
 * real change (blur, Esc, Tab through a cell) doesn't mark the draft dirty or
 * push an empty undo step.
 */

/** Patch for a text element's `text`, or `null` if it's unchanged. */
export function buildTextCommitPatch(
  element: TemplateElement,
  newText: string,
): Partial<TemplateElement> | null {
  return newText === element.text ? null : { text: newText };
}

/**
 * Patch for one table cell, or `null` if the committed value (after
 * line-items formatting + subtotal recompute) leaves the row unchanged.
 *
 * The comparison runs on the *normalized* row, so a value that formats back to
 * what's stored (e.g. price input "10000" → "$ 10.000") is a no-op too.
 */
export function buildCellCommitPatch(
  element: TemplateElement,
  cell: { row: number; col: number },
  newValue: string,
): Partial<TemplateElement> | null {
  const table = element.table;
  const currentRow = table?.cells[cell.row];
  if (!table || !currentRow) return null;

  const lineItems = isLineItems(element);
  const nextRow = [...currentRow];
  nextRow[cell.col] = formatEditedCell(newValue, cell.row, cell.col, lineItems);
  if (lineItems && cell.row > 0) {
    setLineItemSubtotal(nextRow, table.colWidths.length);
  }

  const unchanged =
    nextRow.length === currentRow.length &&
    nextRow.every((value, index) => value === currentRow[index]);
  if (unchanged) return null;

  const cells = table.cells.map((row, index) =>
    index === cell.row ? nextRow : [...row],
  );
  return { table: { ...table, cells } };
}
