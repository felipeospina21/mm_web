import { describe, expect, it } from "vitest";

import type { TableData } from "../_components/types";
import { nextEditableCell } from "./table-navigation";

/** Build a minimal TableData with `cols` columns and `rows` rows. */
function table(rows: number, cols: number): TableData {
  return {
    colWidths: Array.from({ length: cols }, () => 100),
    rowHeight: 20,
    cells: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => `r${r}c${c}`),
    ),
    headerFill: "#000",
    headerColor: "#fff",
    borderColor: "#ccc",
    fontSize: 12,
  };
}

describe("nextEditableCell", () => {
  it("advances to the next column in the same row", () => {
    expect(nextEditableCell(table(3, 4), { row: 1, col: 1 }, false)).toEqual({
      row: 1,
      col: 2,
    });
  });

  it("wraps to the first column of the next row", () => {
    expect(nextEditableCell(table(3, 4), { row: 1, col: 3 }, false)).toEqual({
      row: 2,
      col: 0,
    });
  });

  it("wraps from the last cell back to (0,0)", () => {
    expect(nextEditableCell(table(3, 4), { row: 2, col: 3 }, false)).toEqual({
      row: 0,
      col: 0,
    });
  });

  it("skips the subtotal column for a line-items table", () => {
    // LINE_ITEM_COLS.subtotal === 4; advancing from col 3 lands on 4, skip to 5.
    expect(nextEditableCell(table(2, 6), { row: 1, col: 3 }, true)).toEqual({
      row: 1,
      col: 5,
    });
  });

  it("does NOT skip the subtotal column for a non-line-items table", () => {
    expect(nextEditableCell(table(2, 6), { row: 1, col: 3 }, false)).toEqual({
      row: 1,
      col: 4,
    });
  });

  it("returns null when the table has no cells to navigate to", () => {
    const empty: TableData = {
      colWidths: [],
      rowHeight: 20,
      cells: [],
      headerFill: "#000",
      headerColor: "#fff",
      borderColor: "#ccc",
      fontSize: 12,
    };
    expect(nextEditableCell(empty, { row: 0, col: 0 }, false)).toBeNull();
  });
});
