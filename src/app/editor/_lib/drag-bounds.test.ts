import { describe, expect, it } from "vitest";

import { clampToPageBounds } from "./drag-bounds";
import { PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH } from "../_components/types";

// Page geometry (mirrors getPageOffset): x=40; y=40+(n-1)*(PAGE_HEIGHT+PAGE_GAP).
const PAGE1_X = 40;
const PAGE1_Y = 40;
const PAGE2_Y = 40 + (PAGE_HEIGHT + PAGE_GAP); // second page top (document space)

describe("clampToPageBounds", () => {
  it("leaves an in-bounds position unchanged (page 1, no scroll)", () => {
    const pos = { x: 100, y: 200 };
    expect(
      clampToPageBounds(pos, {
        pageNumber: 1,
        width: 50,
        height: 30,
        scrollTop: 0,
      }),
    ).toEqual({ x: 100, y: 200 });
  });

  it("clamps to the top-left corner when the position is above/left of the page", () => {
    expect(
      clampToPageBounds(
        { x: -999, y: -999 },
        { pageNumber: 1, width: 50, height: 30, scrollTop: 0 },
      ),
    ).toEqual({ x: PAGE1_X, y: PAGE1_Y });
  });

  it("clamps to the bottom-right corner, accounting for element size", () => {
    const width = 100;
    const height = 60;
    expect(
      clampToPageBounds(
        { x: 999999, y: 999999 },
        { pageNumber: 1, width, height, scrollTop: 0 },
      ),
    ).toEqual({
      x: PAGE1_X + PAGE_WIDTH - width,
      y: PAGE1_Y + PAGE_HEIGHT - height,
    });
  });

  it("subtracts scrollTop so bounds track the page's on-screen position", () => {
    const scrollTop = 500;
    // Element pinned to the very top of page 1 => visible top = 40 - 500.
    expect(
      clampToPageBounds(
        { x: PAGE1_X, y: -999 },
        { pageNumber: 1, width: 50, height: 30, scrollTop },
      ),
    ).toEqual({ x: PAGE1_X, y: PAGE1_Y - scrollTop });
  });

  it("uses the correct page offset for a later page", () => {
    // Page 2, no scroll, pulled above its top => clamps to page 2's top.
    expect(
      clampToPageBounds(
        { x: PAGE1_X, y: 0 },
        { pageNumber: 2, width: 50, height: 30, scrollTop: 0 },
      ),
    ).toEqual({ x: PAGE1_X, y: PAGE2_Y });
  });
});
