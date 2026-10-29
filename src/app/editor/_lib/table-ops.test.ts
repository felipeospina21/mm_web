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

    it("normalizes ragged rows to the new column count (trims stray slots)", () => {
      // A copied line-items table shrunk toward 3 columns, but rows still carry
      // extra slots (incl. a stray `null`). removeColumn must leave every row
      // exactly colWidths.length long with no holes.
      const ragged = makeTable({
        colWidths: [73, 241, 126],
        cells: [
          ["CIUDAD", "CIUDAD", "VALOR"],
          ["1", "MEDELLIN", "$0", null as unknown as string, "", ""],
          ["2", "BARRANQUILLA", "$ 40.000", null as unknown as string, ""],
        ],
      });
      const patch = removeColumn(ragged);
      expect(patch?.table?.colWidths).toEqual([73, 241]);
      expect(patch?.table?.cells).toEqual([
        ["CIUDAD", "CIUDAD"],
        ["1", "MEDELLIN"],
        ["2", "BARRANQUILLA"],
      ]);
      // No undefined/null survives.
      expect(
        patch?.table?.cells.every((row) =>
          row.every((cell) => typeof cell === "string"),
        ),
      ).toBe(true);
    });
  });

  describe("addColumn ragged normalization", () => {
    it("pads ragged rows to the new column count with empty strings", () => {
      const ragged = makeTable({
        colWidths: [100, 100],
        cells: [
          ["H1", "H2"],
          ["a"], // short row
          ["c", "d", null as unknown as string], // long row with a hole
        ],
      });
      const patch = addColumn(ragged);
      expect(patch.table?.colWidths).toEqual([100, 100, 120]);
      expect(patch.table?.cells).toEqual([
        ["H1", "H2", ""],
        ["a", "", ""],
        ["c", "d", ""],
      ]);
    });
  });
});
