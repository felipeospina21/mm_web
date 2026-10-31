import { describe, expect, it } from "vitest";

import { getPageOffset } from "./quotation-canvas-geometry";
import { PAGE_GAP, PAGE_HEIGHT } from "../_components/types";

describe("getPageOffset", () => {
  it("places page 1 at the fixed top-left origin", () => {
    expect(getPageOffset(1)).toEqual({ x: 40, y: 40 });
  });

  it("stacks later pages by (PAGE_HEIGHT + PAGE_GAP) per page", () => {
    // Derived from the layout constants, not re-reading the implementation.
    expect(getPageOffset(2)).toEqual({
      x: 40,
      y: 40 + (PAGE_HEIGHT + PAGE_GAP),
    });
    expect(getPageOffset(3)).toEqual({
      x: 40,
      y: 40 + 2 * (PAGE_HEIGHT + PAGE_GAP),
    });
  });

  it("keeps x constant across pages", () => {
    expect(getPageOffset(5).x).toBe(40);
  });
});
