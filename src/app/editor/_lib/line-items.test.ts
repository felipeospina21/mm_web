import { describe, expect, it } from "vitest";

import {
  LINE_ITEM_COLS,
  formatEditedCell,
  setLineItemSubtotal,
} from "./line-items";

describe("LINE_ITEM_COLS", () => {
  it("pins the known column positions", () => {
    expect(LINE_ITEM_COLS).toEqual({ quantity: 0, price: 3, subtotal: 4 });
  });
});

describe("formatEditedCell", () => {
  it("passes the header row through unchanged", () => {
    expect(formatEditedCell("Qty", 0, LINE_ITEM_COLS.quantity, true)).toBe("Qty");
  });

  it("passes non-line-items tables through unchanged", () => {
    expect(formatEditedCell("12ab", 1, LINE_ITEM_COLS.quantity, false)).toBe(
      "12ab",
    );
  });

  it("strips non-digits from the quantity column", () => {
    expect(formatEditedCell("1a2b3", 1, LINE_ITEM_COLS.quantity, true)).toBe(
      "123",
    );
  });

  it("formats the price column as COP currency", () => {
    expect(formatEditedCell("1234", 1, LINE_ITEM_COLS.price, true)).toBe(
      "$ 1.234",
    );
  });

  it("formats a price that already contains currency punctuation", () => {
    expect(formatEditedCell("$ 1.234", 1, LINE_ITEM_COLS.price, true)).toBe(
      "$ 1.234",
    );
  });

  it("returns an empty string for blank price", () => {
    expect(formatEditedCell("", 1, LINE_ITEM_COLS.price, true)).toBe("");
    expect(formatEditedCell("   ", 1, LINE_ITEM_COLS.price, true)).toBe("");
  });

  it("treats non-numeric price text as zero (digits stripped to empty → 0)", () => {
    // Documents existing behavior: `\D` strip of "abc" yields "" → Number("")
    // is 0 (finite), and the input is not blank, so it formats as "$ 0".
    expect(formatEditedCell("abc", 1, LINE_ITEM_COLS.price, true)).toBe("$ 0");
  });

  it("leaves other columns untouched", () => {
    expect(formatEditedCell("Widget", 1, 1, true)).toBe("Widget");
  });
});

describe("setLineItemSubtotal", () => {
  it("computes subtotal = quantity x price into the subtotal column", () => {
    const row = ["3", "Widget", "", "$ 1.000", ""];
    setLineItemSubtotal(row);
    expect(row[LINE_ITEM_COLS.subtotal]).toBe("$ 3.000");
  });

  it("parses digits out of the price before multiplying", () => {
    const row = ["2", "Widget", "", "$ 2.500", ""];
    setLineItemSubtotal(row);
    expect(row[LINE_ITEM_COLS.subtotal]).toBe("$ 5.000");
  });

  it("clears the subtotal when quantity is missing", () => {
    const row = ["", "Widget", "", "$ 1.000", "stale"];
    setLineItemSubtotal(row);
    expect(row[LINE_ITEM_COLS.subtotal]).toBe("");
  });

  it("clears the subtotal when price is missing", () => {
    const row = ["3", "Widget", "", "", "stale"];
    setLineItemSubtotal(row);
    expect(row[LINE_ITEM_COLS.subtotal]).toBe("");
  });

  it("is a no-op when the table has no subtotal column (shrunk below 5 cols)", () => {
    // A copied line-items table the user shrank to 3 columns. Writing row[4]
    // here would strand holes at indices 3/4 (serialized to `null`), which
    // crashes PDF export. With the real column count the rule writes nothing.
    const row = ["1", "MEDELLIN", "$0"];
    setLineItemSubtotal(row, 3);
    expect(row).toEqual(["1", "MEDELLIN", "$0"]);
    expect(row).toHaveLength(3);
  });

  it("still computes the subtotal when the subtotal column exists", () => {
    const row = ["3", "Widget", "", "$ 1.000", ""];
    setLineItemSubtotal(row, 5);
    expect(row[LINE_ITEM_COLS.subtotal]).toBe("$ 3.000");
  });

  it("is a no-op at exactly the subtotal boundary (columnCount === 4)", () => {
    const row = ["3", "Widget", "", "$ 1.000"];
    setLineItemSubtotal(row, 4);
    expect(row).toHaveLength(4);
  });
});
