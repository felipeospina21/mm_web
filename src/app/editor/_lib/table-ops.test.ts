import { describe, expect, it } from "vitest";

import type { TableData } from "../_components/types";
import {
  addColumn,
  addRow,
  removeColumn,
  removeRow,
  removeSelectedRows,
} from "./table-ops";

function makeTable(overrides: Partial<TableData> = {}): TableData {
  return {
    colWidths: [100, 100],
    rowHeight: 20,
    cells: [
      ["H1", "H2"], // header row
      ["a", "b"],
      ["c", "d"],
    ],
    headerFill: "#000",
    headerColor: "#fff",
    borderColor: "#ccc",
    fontSize: 12,
    ...overrides,
  };
}

describe("table-ops", () => {
  describe("addRow", () => {
    it("appends an empty row matching the column count", () => {
      const patch = addRow(makeTable());
      expect(patch.table?.cells).toHaveLength(4);
      expect(patch.table?.cells[3]).toEqual(["", ""]);
    });

    it("uses zero columns when the table has no rows", () => {
      const patch = addRow(makeTable({ cells: [] }));
      expect(patch.table?.cells).toEqual([[]]);
    });

    it("does not mutate the input table", () => {
      const table = makeTable();
      addRow(table);
      expect(table.cells).toHaveLength(3);
    });
  });

  describe("removeRow", () => {
    it("drops the last row", () => {
      const patch = removeRow(makeTable());
      expect(patch?.table?.cells).toHaveLength(2);
      expect(patch?.table?.cells.at(-1)).toEqual(["a", "b"]);
    });

    it("is a no-op when only the header row remains", () => {
      expect(removeRow(makeTable({ cells: [["H1", "H2"]] }))).toBeNull();
    });
  });

  describe("removeSelectedRows", () => {
    it("removes the selected data rows and recomputes height", () => {
      const patch = removeSelectedRows(makeTable(), [1]);
      expect(patch?.table?.cells).toEqual([
        ["H1", "H2"],
        ["c", "d"],
      ]);
      expect(patch?.height).toBe(20 * 2); // rowHeight * remaining rows
    });

    it("never removes the header row even if index 0 is selected", () => {
      const patch = removeSelectedRows(makeTable(), [0, 2]);
      expect(patch?.table?.cells).toEqual([
        ["H1", "H2"],
        ["a", "b"],
      ]);
    });

    it("is a no-op when nothing is selected", () => {
      expect(removeSelectedRows(makeTable(), [])).toBeNull();
    });

    it("is a no-op when the selection removes nothing (only header)", () => {
      expect(removeSelectedRows(makeTable(), [0])).toBeNull();
    });
  });

  describe("addColumn", () => {
    it("appends a column with default width and empty cells", () => {
      const patch = addColumn(makeTable());
      expect(patch.table?.colWidths).toEqual([100, 100, 120]);
      expect(patch.table?.cells).toEqual([
        ["H1", "H2", ""],
        ["a", "b", ""],
        ["c", "d", ""],
      ]);
    });
  });

  describe("removeColumn", () => {
    it("drops the last column across all rows", () => {
      const patch = removeColumn(makeTable());
      expect(patch?.table?.colWidths).toEqual([100]);
      expect(patch?.table?.cells).toEqual([["H1"], ["a"], ["c"]]);
    });

    it("is a no-op when only one column remains", () => {
      const single = makeTable({
        colWidths: [100],
        cells: [["H1"], ["a"]],
      });
      expect(removeColumn(single)).toBeNull();
    });
  });
});
