import { describe, expect, it } from "vitest";

import type { TemplateElement } from "../_components/types";
import { buildCellCommitPatch, buildTextCommitPatch } from "./inline-commit";

function textElement(text: string): TemplateElement {
  return {
    id: "t1",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    text,
    fontSize: 12,
    fill: "#000",
    isDraggable: true,
    isEditable: true,
  };
}

function tableElement(
  cells: string[][],
  role?: TemplateElement["role"],
): TemplateElement {
  return {
    id: "tbl1",
    ...(role ? { role } : {}),
    type: "table",
    x: 0,
    y: 0,
    width: 500,
    height: 90,
    text: "",
    fontSize: 12,
    fill: "#000",
    isDraggable: true,
    isEditable: true,
    table: {
      colWidths: cells[0]!.map(() => 100),
      rowHeight: 30,
      cells,
      headerFill: "#eee",
      headerColor: "#111",
      borderColor: "#ccc",
      fontSize: 10,
    },
  };
}

describe("buildTextCommitPatch", () => {
  it("returns null when the text is unchanged (Esc / blur without typing)", () => {
    expect(buildTextCommitPatch(textElement("Hola"), "Hola")).toBeNull();
  });

  it("returns a text patch when the text changed", () => {
    expect(buildTextCommitPatch(textElement("Hola"), "Hola mundo")).toEqual({
      text: "Hola mundo",
    });
  });

  it("treats whitespace-only differences as a real change", () => {
    expect(buildTextCommitPatch(textElement("Hola"), "Hola ")).toEqual({
      text: "Hola ",
    });
  });
});

describe("buildCellCommitPatch — plain table", () => {
  const element = tableElement([
    ["A", "B"],
    ["x", "y"],
  ]);

  it("returns null when the cell value is unchanged", () => {
    expect(buildCellCommitPatch(element, { row: 1, col: 0 }, "x")).toBeNull();
  });

  it("patches only the edited cell and leaves the source untouched", () => {
    const patch = buildCellCommitPatch(element, { row: 1, col: 1 }, "z");
    expect(patch?.table?.cells).toEqual([
      ["A", "B"],
      ["x", "z"],
    ]);
    expect(element.table!.cells[1]).toEqual(["x", "y"]);
  });

  it("returns null for an out-of-range row", () => {
    expect(buildCellCommitPatch(element, { row: 9, col: 0 }, "q")).toBeNull();
  });

  it("returns null for an element without a table", () => {
    expect(
      buildCellCommitPatch(textElement("t"), { row: 0, col: 0 }, "q"),
    ).toBeNull();
  });
});

describe("buildCellCommitPatch — line-items table", () => {
  // qty, description, unit, price, subtotal
  const element = tableElement(
    [
      ["Cant.", "Descripción", "Unidad", "Precio", "Subtotal"],
      ["2", "Item", "u", "$ 10.000", "$ 20.000"],
    ],
    "line-items",
  );

  it("is a no-op when the stripped price input formats back to the stored value", () => {
    // The editor shows the price as digits ("10000"); committing it unchanged
    // re-formats to the stored "$ 10.000" — no real change.
    expect(
      buildCellCommitPatch(element, { row: 1, col: 3 }, "10000"),
    ).toBeNull();
  });

  it("is a no-op when Esc commits the stored (formatted) price back", () => {
    expect(
      buildCellCommitPatch(element, { row: 1, col: 3 }, "$ 10.000"),
    ).toBeNull();
  });

  it("recomputes the subtotal when the quantity changes", () => {
    const patch = buildCellCommitPatch(element, { row: 1, col: 0 }, "3");
    expect(patch?.table?.cells[1]).toEqual([
      "3",
      "Item",
      "u",
      "$ 10.000",
      "$ 30.000",
    ]);
  });

  it("commits when a stale subtotal would be corrected (real change)", () => {
    const stale = tableElement(
      [
        ["Cant.", "Descripción", "Unidad", "Precio", "Subtotal"],
        ["2", "Item", "u", "$ 10.000", "$ 1"],
      ],
      "line-items",
    );
    const patch = buildCellCommitPatch(stale, { row: 1, col: 0 }, "2");
    expect(patch?.table?.cells[1]?.[4]).toBe("$ 20.000");
  });
});
