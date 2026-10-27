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
  return {
    table: {
      ...table,
      colWidths: [...table.colWidths, 120],
      cells: table.cells.map((row) => [...row, ""]),
    },
  };
}

/** Drop the last column. No-op when only one column remains. */
export function removeColumn(table: TableData): TablePatch | null {
  if (table.colWidths.length <= 1) return null;
  return {
    table: {
      ...table,
      colWidths: table.colWidths.slice(0, -1),
      cells: table.cells.map((row) => row.slice(0, -1)),
    },
  };
}
