/**
 * Shared line-item table rules for the quotation editor.
 *
 * The "line items" table encodes business rules in fixed columns: quantity is
 * digit-only, price is formatted as COP currency, and the subtotal is computed
 * (quantity × price), never typed. These helpers are the single source of truth
 * for that behaviour — both inline cell editing (`use-inline-editing.ts`) and
 * clipboard paste (`clipboard.ts`) use them so the two paths cannot drift.
 *
 * Pure and framework-agnostic: no React, no Konva. Unit-tested in
 * `line-items.test.ts`.
 */

/** Column positions in a line-items table. */
export const LINE_ITEM_COLS = {
  quantity: 0,
  price: 3,
  subtotal: 4,
} as const;

/** Format COP currency the way the editor displays it: `$ 1.234`. */
function formatCop(amount: number): string {
  return `$ ${amount.toLocaleString("es-CO")}`;
}

/**
 * Normalize a cell value as it is committed into a line-items table.
 * - header row (row 0) and non-line-items tables are passed through unchanged
 * - quantity (col 0) keeps digits only
 * - price (col 3) is parsed to a number and re-formatted as COP; blank/invalid
 *   input collapses to an empty string
 */
export function formatEditedCell(
  value: string,
  row: number,
  col: number,
  isLineItemsTable: boolean,
): string {
  if (row === 0 || !isLineItemsTable) return value;
  if (col === LINE_ITEM_COLS.quantity) return value.replace(/\D/g, "");
  if (col === LINE_ITEM_COLS.price) {
    const amount = Number(value.replace(/\D/g, ""));
    return value.trim() === "" || !Number.isFinite(amount) ? "" : formatCop(amount);
  }
  return value;
}

/**
 * Recompute the subtotal cell (col 4) in place from the row's quantity (col 0)
 * and price (col 3). Clears the subtotal when either input is missing.
 *
 * The line-item columns are positional, so this is a no-op when the table no
 * longer has those columns — e.g. a copied line-items table that the user has
 * shrunk below 5 columns. Writing `row[4]` on such a row would force the
 * missing in-between slots into existence as holes (serialized to `null` on
 * save), which later crashes the PDF exporter. `columnCount` lets the rule stay
 * within the table's real width. When omitted, the legacy full-width behaviour
 * is preserved.
 */
export function setLineItemSubtotal(row: string[], columnCount?: number): void {
  // No subtotal (or price) column in the current table → nothing to compute.
  if (columnCount !== undefined && columnCount <= LINE_ITEM_COLS.subtotal) {
    return;
  }
  const quantity = row[LINE_ITEM_COLS.quantity]?.replace(/\D/g, "") ?? "";
  const price = row[LINE_ITEM_COLS.price]?.replace(/\D/g, "") ?? "";
  row[LINE_ITEM_COLS.subtotal] =
    quantity && price ? formatCop(Number(quantity) * Number(price)) : "";
}
