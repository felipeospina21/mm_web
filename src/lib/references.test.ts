import { describe, expect, it } from "vitest";

import { MAX_REFERENCES, parseReferences } from "./references";

describe("parseReferences", () => {
  it("splits the example string on commas and trims each entry", () => {
    expect(parseReferences("cp-10, au 20 4, xtron")).toEqual([
      "cp-10",
      "au 20 4",
      "xtron",
    ]);
  });

  it("returns an empty array for empty / whitespace-only input", () => {
    expect(parseReferences("")).toEqual([]);
    expect(parseReferences("   ")).toEqual([]);
    expect(parseReferences(",")).toEqual([]);
    expect(parseReferences(" , , ")).toEqual([]);
  });

  it("drops empty entries from trailing / doubled commas", () => {
    expect(parseReferences("a,,b,")).toEqual(["a", "b"]);
    expect(parseReferences(",a,b")).toEqual(["a", "b"]);
  });

  it("preserves inner spaces in a SKU", () => {
    expect(parseReferences("au 20 4")).toEqual(["au 20 4"]);
  });

  it("de-duplicates case-insensitively, keeping the first-seen casing", () => {
    expect(parseReferences("CP-10, cp-10, Cp-10, AB")).toEqual(["CP-10", "AB"]);
  });

  it("preserves the order the user typed them in", () => {
    expect(parseReferences("c, a, b, a")).toEqual(["c", "a", "b"]);
  });

  it("exposes a defensive maximum", () => {
    expect(MAX_REFERENCES).toBeGreaterThan(0);
  });
});
