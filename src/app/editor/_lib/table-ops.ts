/**
 * Pure table-mutation helpers for the floating toolbar.
 *
 * Each function takes the current table (and any args) and returns a
 * `Partial<TemplateElement>` patch to apply, or `null` when the operation is a
 * no-op (so the caller can skip the change). Keeping these out of the component
 * makes the row/column edge cases (min-one guards, header-row preservation,
 * height recompute) unit-testable.
 */

import type { TableData, TemplateElement } from "../_components/types";

type TablePatch = Partial<TemplateElement>;

/** Append an empty row matching the current column count. */
export function addRow(table: TableData): TablePatch {
  const cols = table.cells[0]?.length ?? 0;
  return {
    table: {
      ...table,
      cells: [...table.cells, Array.from({ length: cols }, () => "")],
    },
  };
}

/** Drop the last row. No-op when only the header row remains. */
export function removeRow(table: TableData): TablePatch | null {
  if (table.cells.length <= 1) return null;
  return {
    table: {
      ...table,
      cells: table.cells.slice(0, -1),
    },
  };
}

/**
 * Remove the given data rows (by index), always preserving the header row
 * (index 0). Recomputes element height from the remaining row count. No-op when
 * nothing is selected or nothing would change.
 */
export function removeSelectedRows(
  table: TableData,
  selectedRows: number[],
): TablePatch | null {
  if (selectedRows.length === 0) return null;
  const rowsToRemove = new Set(selectedRows);
  const cells = table.cells.filter(
    (_, index) => index === 0 || !rowsToRemove.has(index),
  );
  if (cells.length === table.cells.length) return null;
  return {
    height: table.rowHeight * cells.length,
    table: { ...table, cells },
  };
}

/** Append a column (default width 120) with an empty cell in every row. */
export function addColumn(table: TableData): TablePatch {
  const colWidths = [...table.colWidths, 120];
  return {
    table: {
      ...table,
      colWidths,
      // Normalize every row to the new column count. Rows that were ragged
      // (e.g. a copied line-items table with stray trailing slots) become
      // rectangular, which keeps cells aligned with colWidths and prevents the
      // orphaned `null`/`undefined` slots that crash PDF export.
      cells: table.cells.map((row) => normalizeRow(row, colWidths.length)),
    },
  };
}

/** Drop the last column. No-op when only one column remains. */
export function removeColumn(table: TableData): TablePatch | null {
  if (table.colWidths.length <= 1) return null;
  const colWidths = table.colWidths.slice(0, -1);
  return {
    table: {
      ...table,
      colWidths,
      // Trim/pad every row to exactly the remaining column count so no row is
      // left longer than colWidths (which would strand cells past the last real
      // column — the source of the `null` slots that crash PDF export).
      cells: table.cells.map((row) => normalizeRow(row, colWidths.length)),
    },
  };
}

/**
 * Force a row to exactly `columnCount` string cells: truncate extras and fill
 * any missing/holey slots with `""`. Keeps table data rectangular and free of
 * `null`/`undefined` holes.
 */
function normalizeRow(row: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? "");
}
