import { describe, expect, it } from "vitest";

import { withActivePage } from "./visible-pages";

describe("withActivePage", () => {
  it("returns the same set when the active page is already visible", () => {
    const visible = new Set([1, 2, 3]);
    expect(withActivePage(visible, 2)).toBe(visible);
  });

  it("adds an active page that is outside the visible window", () => {
    const visible = new Set([1, 2, 3]);
    const result = withActivePage(visible, 7);
    expect([...result].sort((a, b) => a - b)).toEqual([1, 2, 3, 7]);
  });

  it("does not mutate the input set", () => {
    const visible = new Set([1, 2]);
    withActivePage(visible, 9);
    expect([...visible]).toEqual([1, 2]);
  });
});
