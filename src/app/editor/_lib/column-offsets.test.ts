import { describe, expect, it } from "vitest";

import { columnOffsets } from "./column-offsets";

describe("columnOffsets", () => {
  it("returns [0] for no columns", () => {
    expect(columnOffsets([])).toEqual([0]);
  });

  it("computes prefix sums with a leading 0 and trailing total", () => {
    // before col0=0, before col1=70, before col2=300, before col3=400; total=540
    expect(columnOffsets([70, 230, 100, 140])).toEqual([0, 70, 300, 400, 540]);
  });

  it("offsets[i] is the sum of widths before column i (matches slice().reduce())", () => {
    const widths = [12, 34, 56, 78, 90];
    const offsets = columnOffsets(widths);
    for (let col = 0; col < widths.length; col += 1) {
      const expected = widths.slice(0, col).reduce((a, b) => a + b, 0);
      expect(offsets[col]).toBe(expected);
    }
    // last entry is the full total
    expect(offsets[widths.length]).toBe(
      widths.reduce((a, b) => a + b, 0),
    );
  });

  it("treats a single column as [0, width]", () => {
    expect(columnOffsets([250])).toEqual([0, 250]);
  });
});
