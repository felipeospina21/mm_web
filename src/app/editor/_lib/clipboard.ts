import type { PageData, TableData, TemplateElement } from "../_components/types";
import { isLineItems } from "./element-role";
import {
  LINE_ITEM_COLS,
  formatEditedCell,
  setLineItemSubtotal,
} from "./line-items";

export interface TableSelection {
  rows: number[];
  columns: number[];
  cells: Array<{ row: number; col: number }>;
}

export interface TablePasteResult {
  cells: string[][];
  height?: number;
  selectedRows?: number[];
  clearSelectedCells?: boolean;
}

export function cloneElement(element: TemplateElement): TemplateElement {
  return {
    ...element,
    table: element.table
      ? {
          ...element.table,
          cells: element.table.cells.map((row) => [...row]),
          colWidths: [...element.table.colWidths],
        }
      : undefined,
  };
}

export function makePastedElement(
  element: TemplateElement,
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
): TemplateElement {
  const copy = cloneElement(element);
  return {
    ...copy,
    id: `${copy.id}-copy-${Date.now()}`,
    x: Math.max(0, Math.min(pageWidth - copy.width, x + 20)),
    y: Math.max(0, Math.min(pageHeight - copy.height, y + 20)),
  };
}

export function getTableClipboardText(
  table: TableData,
  selection: TableSelection,
): string | null {
  const rows = selection.rows
    .filter((row) => row > 0 && row < table.cells.length)
    .sort((a, b) => a - b);
  const cells = selection.cells
    .filter(({ row, col }) => row > 0 && row < table.cells.length && col >= 0)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const columns = selection.columns
    .filter((col) => col >= 0 && col < table.colWidths.length)
    .sort((a, b) => a - b);

  if (rows.length === 0 && columns.length === 0 && cells.length === 0) {
    return null;
  }
  if (rows.length > 0) {
    return rows
      .map((row) => table.cells[row]?.join("\t") ?? "")
      .join("\n");
  }
  if (columns.length > 0) {
    return table.cells
      .slice(1)
      .map((row) => columns.map((col) => row[col] ?? "").join("\t"))
      .join("\n");
  }

  const minRow = Math.min(...cells.map(({ row }) => row));
  const maxRow = Math.max(...cells.map(({ row }) => row));
  const minCol = Math.min(...cells.map(({ col }) => col));
  const maxCol = Math.max(...cells.map(({ col }) => col));
  const selectedCellSet = new Set(cells.map(({ row, col }) => `${row}:${col}`));
  return Array.from({ length: maxRow - minRow + 1 }, (_, rowOffset) =>
    Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => {
      const row = minRow + rowOffset;
      const col = minCol + colOffset;
      return selectedCellSet.has(`${row}:${col}`)
        ? (table.cells[row]?.[col] ?? "")
        : "";
    }).join("\t"),
  ).join("\n");
}

function parseClipboardRows(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((row) => row.split("\t"));
}

export function pasteIntoTable(
  text: string,
  table: TableData,
  element: TemplateElement,
  selection: TableSelection,
): TablePasteResult | null {
  const rows = parseClipboardRows(text);
  const cells = table.cells.map((row) => [...row]);
  const columnCount = table.colWidths.length;
  const isLineItemsTable = isLineItems(element);

  if (selection.cells.length > 0) {
    const start = [...selection.cells].sort(
      (a, b) => a.row - b.row || a.col - b.col,
    )[0]!;
    rows.forEach((sourceRow, rowOffset) => {
      sourceRow.forEach((value, colOffset) => {
        const rowIndex = start.row + rowOffset;
        const colIndex = start.col + colOffset;
        if (rowIndex === 0 || colIndex >= columnCount) return;
        while (cells.length <= rowIndex) {
          cells.push(Array.from({ length: columnCount }, () => ""));
        }
        const row = cells[rowIndex];
        if (!row || (isLineItemsTable && colIndex === LINE_ITEM_COLS.subtotal))
          return;
        row[colIndex] = formatEditedCell(value, rowIndex, colIndex, isLineItemsTable);
        if (isLineItemsTable) setLineItemSubtotal(row, columnCount);
      });
    });
    return { cells, clearSelectedCells: true };
  }

  if (selection.columns.length > 0) {
    const startColumn = Math.min(...selection.columns);
    rows.forEach((sourceRow, rowOffset) => {
      const rowIndex = rowOffset + 1;
      while (cells.length <= rowIndex) {
        cells.push(Array.from({ length: columnCount }, () => ""));
      }
      const row = cells[rowIndex];
      if (!row) return;
      sourceRow.forEach((value, colOffset) => {
        const colIndex = startColumn + colOffset;
        if (
          colIndex >= columnCount ||
          (isLineItemsTable && colIndex === LINE_ITEM_COLS.subtotal)
        )
          return;
        row[colIndex] = formatEditedCell(value, rowIndex, colIndex, isLineItemsTable);
      });
      if (isLineItemsTable) setLineItemSubtotal(row, columnCount);
    });
    return { cells, height: table.rowHeight * cells.length };
  }

  if (selection.rows.length > 0) {
    const startRow = Math.min(...selection.rows);
    rows.forEach((sourceRow, rowOffset) => {
      const rowIndex = startRow + rowOffset;
      while (cells.length <= rowIndex) {
        cells.push(Array.from({ length: columnCount }, () => ""));
      }
      const row = cells[rowIndex];
      if (!row) return;
      sourceRow.slice(0, columnCount).forEach((value, colIndex) => {
        if (isLineItemsTable && colIndex === LINE_ITEM_COLS.subtotal) return;
        row[colIndex] = formatEditedCell(value, rowIndex, colIndex, isLineItemsTable);
      });
      if (isLineItemsTable) setLineItemSubtotal(row, columnCount);
    });
    return {
      cells,
      height: table.rowHeight * cells.length,
      selectedRows: rows.map((_, offset) => startRow + offset),
      clearSelectedCells: true,
    };
  }

  return null;
}

export function findSelectedTable(pages: PageData[], selectedId: string | null) {
  const page = pages.find((item) =>
    item.elements.some((element) => element.id === selectedId && element.table),
  );
  const element = page?.elements.find(
    (item) => item.id === selectedId && item.table,
  );
  return page && element?.table ? { page, element, table: element.table } : null;
}
