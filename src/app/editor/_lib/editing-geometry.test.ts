import { describe, expect, it } from "vitest";

import { computeContentTop, computeEditingBox } from "./editing-geometry";

describe("computeContentTop", () => {
  it("sums stage top, page offset and element y for a plain element", () => {
    expect(
      computeContentTop({ stageTop: 10, offsetY: 100, elementY: 5 }),
    ).toBe(115);
  });

  it("adds row * rowHeight for a table cell", () => {
    expect(
      computeContentTop({
        stageTop: 10,
        offsetY: 100,
        elementY: 5,
        row: 2,
        rowHeight: 20,
      }),
    ).toBe(155);
  });
});

describe("computeEditingBox", () => {
  it("positions a text element box (no column offset)", () => {
    expect(
      computeEditingBox({
        stageLeft: 50,
        offsetX: 40,
        elementX: 8,
        contentTop: 115,
        scrollTop: 30,
        width: 600,
        height: 40,
        fontSize: 16,
        color: "#111",
      }),
    ).toEqual({
      left: 98,
      top: 85,
      width: 600,
      height: 40,
      fontSize: 16,
      color: "#111",
    });
  });

  it("offsets a table cell box by the preceding column widths", () => {
    // col 2 => offset is colWidths[0] + colWidths[1] = 30 + 40 = 70
    expect(
      computeEditingBox({
        stageLeft: 50,
        offsetX: 40,
        elementX: 8,
        contentTop: 200,
        scrollTop: 0,
        width: 50,
        height: 20,
        fontSize: 12,
        color: "#333333",
        colWidths: [30, 40, 50, 60],
        col: 2,
      }),
    ).toEqual({
      left: 168,
      top: 200,
      width: 50,
      height: 20,
      fontSize: 12,
      color: "#333333",
    });
  });

  it("applies no column offset for col 0", () => {
    const box = computeEditingBox({
      stageLeft: 0,
      offsetX: 0,
      elementX: 0,
      contentTop: 0,
      scrollTop: 0,
      width: 10,
      height: 10,
      fontSize: 12,
      color: "#000",
      colWidths: [30, 40],
      col: 0,
    });
    expect(box.left).toBe(0);
  });
});
