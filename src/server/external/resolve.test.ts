import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RawExternalProduct } from "./products";

// Mock the external fetch so the resolve logic is tested in isolation (no
// network). The Zod firewall / normalization runs for real.
const fetchProductsBySkus = vi.fn();
vi.mock("./products", () => ({
  MAX_SKUS_PER_REQUEST: 20,
  fetchProductsBySkus: (skus: string[]): unknown => fetchProductsBySkus(skus),
}));

import { resolveSkus } from "./resolve";

/** Minimal raw product the firewall can normalize. */
function rawProduct(sku: string): RawExternalProduct {
  return {
    id: Math.floor(Math.random() * 1e6),
    sku,
    name: `Product ${sku}`,
    effective_price: "19990.00",
    variations: [],
  };
}

beforeEach(() => {
  fetchProductsBySkus.mockReset();
  // Silence the structured logger emitted by resolveSkus.
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("resolveSkus", () => {
  it("resolves every requested SKU when all are found", async () => {
    fetchProductsBySkus.mockResolvedValue(
      new Map([
        ["KIT002", rawProduct("KIT002")],
        ["MP-4410", rawProduct("MP-4410")],
      ]),
    );

    const out = await resolveSkus(["KIT002", "MP-4410"]);

    expect(out.resolved.map((p) => p.reference)).toEqual(["KIT002", "MP-4410"]);
    expect(out.unresolved).toEqual([]);
  });

  it("splits found vs not-found (partial resolution)", async () => {
    fetchProductsBySkus.mockResolvedValue(
      new Map([["KIT002", rawProduct("KIT002")]]),
    );

    const out = await resolveSkus(["KIT002", "GHOST"]);

    expect(out.resolved.map((p) => p.reference)).toEqual(["KIT002"]);
    expect(out.unresolved).toEqual(["GHOST"]);
  });

  it("matches case-insensitively but returns the API's canonical reference", async () => {
    fetchProductsBySkus.mockResolvedValue(
      new Map([["KIT002", rawProduct("KIT002")]]),
    );

    const out = await resolveSkus(["kit002"]);

    expect(out.resolved).toHaveLength(1);
    expect(out.resolved[0]!.reference).toBe("KIT002");
    expect(out.unresolved).toEqual([]);
  });

  it("marks everything unresolved when nothing is found", async () => {
    fetchProductsBySkus.mockResolvedValue(new Map());

    const out = await resolveSkus(["A", "B"]);

    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual(["A", "B"]);
  });

  it("short-circuits on empty input without calling the API", async () => {
    const out = await resolveSkus([]);

    expect(out).toEqual({ resolved: [], unresolved: [] });
    expect(fetchProductsBySkus).not.toHaveBeenCalled();
  });

  it("preserves the requested order in the resolved list", async () => {
    fetchProductsBySkus.mockResolvedValue(
      new Map([
        ["B", rawProduct("B")],
        ["A", rawProduct("A")],
      ]),
    );

    const out = await resolveSkus(["A", "B"]);
    expect(out.resolved.map((p) => p.reference)).toEqual(["A", "B"]);
  });

  it("treats an un-normalizable payload as unresolved", async () => {
    // Missing the required `sku` key → normalizeProduct throws → unresolved.
    fetchProductsBySkus.mockResolvedValue(
      new Map([["BAD", { id: 1 } as unknown as RawExternalProduct]]),
    );

    const out = await resolveSkus(["BAD"]);

    expect(out.resolved).toEqual([]);
    expect(out.unresolved).toEqual(["BAD"]);
  });
});
