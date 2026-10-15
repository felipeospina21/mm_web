import { afterEach, describe, expect, it, vi } from "vitest";

import * as client from "./client";
import { fetchProductsBySkus, MAX_SKUS_PER_REQUEST } from "./products";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a `/products` envelope around the given product objects. */
function envelope(products: { id: number; sku: string }[]) {
  return {
    success: true,
    message: "Success",
    data: { products, pagination: { page: 1, total: products.length } },
  };
}

describe("fetchProductsBySkus", () => {
  it("short-circuits to an empty map on empty input without calling the API", async () => {
    const spy = vi.spyOn(client, "externalGet");
    const out = await fetchProductsBySkus([]);
    expect(out.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("issues ONE request for <= 20 SKUs and keys the result by sku", async () => {
    const spy = vi.spyOn(client, "externalGet").mockResolvedValue(
      envelope([
        { id: 1, sku: "KIT002" },
        { id: 2, sku: "MP-4410" },
      ]),
    );

    const out = await fetchProductsBySkus(["KIT002", "MP-4410", "GHOST"]);

    expect(spy).toHaveBeenCalledTimes(1);
    // The comma-joined skus are passed as a query param (client encodes it).
    expect(spy).toHaveBeenCalledWith("/products", {
      query: { skus: "KIT002,MP-4410,GHOST" },
    });
    expect(out.get("KIT002")).toMatchObject({ id: 1 });
    expect(out.get("MP-4410")).toMatchObject({ id: 2 });
    // Unreturned SKU is absent (caller computes "unresolved").
    expect(out.has("GHOST")).toBe(false);
  });

  it("de-duplicates and trims input SKUs", async () => {
    const spy = vi.spyOn(client, "externalGet").mockResolvedValue(envelope([]));

    await fetchProductsBySkus([" A ", "A", "B", "", "  "]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("/products", { query: { skus: "A,B" } });
  });

  it("chunks into batches of 20 and merges the responses", async () => {
    // 21 SKUs -> 2 batches (20 + 1).
    const skus = Array.from({ length: 21 }, (_, i) => `S${i + 1}`);

    const spy = vi
      .spyOn(client, "externalGet")
      .mockResolvedValueOnce(
        envelope(skus.slice(0, 20).map((sku, i) => ({ id: i + 1, sku }))),
      )
      .mockResolvedValueOnce(envelope([{ id: 21, sku: "S21" }]));

    const out = await fetchProductsBySkus(skus);

    expect(spy).toHaveBeenCalledTimes(2);
    // First batch has exactly MAX_SKUS_PER_REQUEST skus.
    const firstQuery = (spy.mock.calls[0]![1] as { query: { skus: string } })
      .query.skus;
    expect(firstQuery.split(",")).toHaveLength(MAX_SKUS_PER_REQUEST);
    // Second batch has the remainder.
    const secondQuery = (spy.mock.calls[1]![1] as { query: { skus: string } })
      .query.skus;
    expect(secondQuery).toBe("S21");
    // All 21 merged into one map.
    expect(out.size).toBe(21);
    expect(out.get("S1")).toMatchObject({ id: 1 });
    expect(out.get("S21")).toMatchObject({ id: 21 });
  });
});
