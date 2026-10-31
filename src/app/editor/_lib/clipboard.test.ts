import { describe, expect, it } from "vitest";

import type { PageData, TableData, TemplateElement } from "../_components/types";
import {
  cloneElement,
  findSelectedTable,
  getTableClipboardText,
  makePastedElement,
  pasteIntoTable,
  type TableSelection,
} from "./clipboard";

function baseElement(overrides: Partial<TemplateElement> = {}): TemplateElement {
  return {
    id: "el-1",
    type: "text",
    x: 10,
    y: 10,
    width: 100,
    height: 40,
    text: "hello",
    fontSize: 12,
    fill: "#000",
    isDraggable: true,
    ...overrides,
  };
}

function table(rows: string[][], cols: number): TableData {
  return {
    colWidths: Array.from({ length: cols }, () => 100),
    rowHeight: 20,
    cells: rows.map((r) => [...r]),
    headerFill: "#000",
    headerColor: "#fff",
    borderColor: "#ccc",
    fontSize: 12,
  };
}

function emptySelection(): TableSelection {
  return { rows: [], columns: [], cells: [] };
}

describe("cloneElement", () => {
  it("deep-copies the table cells and colWidths (no shared references)", () => {
    const el = baseElement({
      type: "table",
      table: table([["a", "b"]], 2),
    });
    const clone = cloneElement(el);
    clone.table!.cells[0]![0] = "mutated";
    clone.table!.colWidths[0] = 999;
    expect(el.table!.cells[0]![0]).toBe("a");
    expect(el.table!.colWidths[0]).toBe(100);
  });

  it("leaves table undefined for a non-table element", () => {
    expect(cloneElement(baseElement()).table).toBeUndefined();
  });
});

describe("makePastedElement", () => {
  it("offsets by +20 and gives a derived -copy- id", () => {
    const pasted = makePastedElement(baseElement(), 50, 60, 800, 1000);
    expect(pasted.x).toBe(70);
    expect(pasted.y).toBe(80);
    expect(pasted.id.startsWith("el-1-copy-")).toBe(true);
  });

  it("clamps within the page bounds", () => {
    // width 100 on an 800-wide page: max x is 700; +20 beyond pushes to clamp.
    const pasted = makePastedElement(baseElement(), 900, -50, 800, 1000);
    expect(pasted.x).toBe(700);
    expect(pasted.y).toBe(0);
  });
});

describe("getTableClipboardText", () => {
  const t = table(
    [
      ["H0", "H1"],
      ["a0", "a1"],
      ["b0", "b1"],
    ],
    2,
  );

  it("returns null when nothing is selected", () => {
    expect(getTableClipboardText(t, emptySelection())).toBeNull();
  });

  it("copies whole rows tab/newline separated (skips header row 0)", () => {
    expect(
      getTableClipboardText(t, { rows: [1, 2, 0], columns: [], cells: [] }),
    ).toBe("a0\ta1\nb0\tb1");
  });

  it("copies columns from the body rows only", () => {
    expect(
      getTableClipboardText(t, { rows: [], columns: [0], cells: [] }),
    ).toBe("a0\nb0");
  });

  it("copies a cell rectangle, blanking unselected cells in the bbox", () => {
    const grid = table(
      [
        ["H0", "H1", "H2"],
        ["a", "b", "c"],
        ["d", "e", "f"],
      ],
      3,
    );
    const text = getTableClipboardText(grid, {
      rows: [],
      columns: [],
      cells: [
        { row: 1, col: 0 },
        { row: 2, col: 2 },
      ],
    });
    // bbox spans rows 1..2 and cols 0..2 (3 wide); only (1,0)=a and (2,2)=f are
    // selected, the rest of the rectangle is blanked.
    expect(text).toBe("a\t\t\n\t\tf");
  });
});

describe("pasteIntoTable", () => {
  it("fills from the top-left of a cell selection, never row 0", () => {
    const el = baseElement({ type: "table", table: table([["H"], [""], [""]], 1) });
    const result = pasteIntoTable("x\ny", el.table!, el, {
      rows: [],
      columns: [],
      cells: [{ row: 1, col: 0 }],
    });
    expect(result?.cells[1]![0]).toBe("x");
    expect(result?.cells[2]![0]).toBe("y");
    expect(result?.clearSelectedCells).toBe(true);
  });

  it("returns null when there is no selection", () => {
    const el = baseElement({ type: "table", table: table([["H"]], 1) });
    expect(
      pasteIntoTable("x", el.table!, el, emptySelection()),
    ).toBeNull();
  });

  it("skips the subtotal column and recomputes it for a line-items table", () => {
    // 5-col line-items: qty(0) .. price(3) subtotal(4). Role drives line-items.
    const el = baseElement({
      id: "line-items-p1",
      type: "table",
      table: table(
        [
          ["Qty", "Desc", "Ref", "Price", "Subtotal"],
          ["", "", "", "", ""],
        ],
        5,
      ),
    });
    // Paste a full row starting at row 1 col 0; col 4 (subtotal) must be ignored
    // as input and recomputed from qty*price.
    const result = pasteIntoTable("2\td\tr\t1000\t999", el.table!, el, {
      rows: [1],
      columns: [],
      cells: [],
    });
    const row = result!.cells[1]!;
    expect(row[0]).toBe("2"); // qty digits only
    expect(row[3]).toBe("$ 1.000"); // price formatted COP
    expect(row[4]).toBe("$ 2.000"); // subtotal = 2 * 1000, recomputed (not "999")
  });
});

describe("findSelectedTable", () => {
  const pages: PageData[] = [
    {
      id: "p1",
      pageNumber: 1,
      elements: [
        baseElement({ id: "text-1" }),
        baseElement({ id: "tbl-1", type: "table", table: table([["a"]], 1) }),
      ],
    },
  ];

  it("returns the page/element/table for a selected table id", () => {
    const found = findSelectedTable(pages, "tbl-1");
    expect(found?.element.id).toBe("tbl-1");
    expect(found?.table.cells[0]![0]).toBe("a");
  });

  it("returns null for a non-table or missing selection", () => {
    expect(findSelectedTable(pages, "text-1")).toBeNull();
    expect(findSelectedTable(pages, "nope")).toBeNull();
    expect(findSelectedTable(pages, null)).toBeNull();
  });
});
