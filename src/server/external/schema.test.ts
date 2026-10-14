import { describe, expect, it } from "vitest";

import {
  __test,
  normalizeProduct,
  normalizeProducts,
} from "./schema";

/**
 * The real sample product from docs/api_example.md (trimmed to the fields the
 * firewall reads, but keeping the messy shapes: stringified images/tags, mixed
 * price types, product attributes[] vs variant flat attribute maps).
 */
const SAMPLE_PRODUCT = {
  id: 12208806,
  sku: "KIT002",
  type: "variable",
  name: "Combo Souvenir",
  description: "Combo práctico para el día a día.",
  short_description: "",
  regular_price: 0,
  sale_price: "0.00",
  effective_price: "19990.00",
  categories: ["Morrales Neveras y Bolsas"],
  tags: '["Novedades 2026-II"]',
  printing_methods: '[{"label":"Validar con la ejecutiva"}]',
  images:
    '{"main_image":["https://example.test/a.jpg"],"gallery_images":[]}',
  packaging_type: "Bolsa de polietileno",
  inventory: 1000,
  connector_id: 59,
  company_id: 9,
  images_locked: 0,
  attributes: [
    { name: "Color", value: "Rojo, Blanco", values: ["Rojo", "Blanco"] },
  ],
  variations: [
    {
      id: 12208807,
      parent_id: 12208806,
      sku: "KIT002-e4db999f",
      name: "Combo Souvenir (Color: Rojo)",
      regular_price: 19990,
      sale_price: "0.00",
      inventory: 500,
      attributes: { Color: "Rojo" },
      categories: "15",
      tags: '["Novedades 2026-II"]',
    },
    {
      id: 12208808,
      sku: "KIT002-1f23cdf5",
      name: "Combo Souvenir (Color: Blanco)",
      regular_price: 19990,
      inventory: 500,
      attributes: { Color: "Blanco" },
    },
  ],
};

describe("normalizeProduct — sample payload", () => {
  it("maps the sample product onto a clean QuotationProduct", () => {
    const { clean, warnings } = normalizeProduct(SAMPLE_PRODUCT);

    expect(clean.id).toBe("12208806");
    expect(clean.reference).toBe("KIT002");
    expect(clean.name).toBe("Combo Souvenir");
    expect(clean.description).toContain("Combo práctico");
    // effective_price (19990) wins over the 0/"0.00" placeholders.
    expect(clean.price).toContain("19.990");
    expect(warnings).toHaveLength(0);
  });

  it("normalizes both variants with color, hex, stock and inherited packaging", () => {
    const { clean } = normalizeProduct(SAMPLE_PRODUCT);

    expect(clean.variants).toHaveLength(2);
    const [rojo, blanco] = clean.variants;

    expect(rojo).toMatchObject({
      id: "12208807",
      colorName: "Rojo",
      colorHex: "#e53935",
      stock: 500,
      packaging: "Bolsa de polietileno",
    });
    expect(blanco).toMatchObject({
      id: "12208808",
      colorName: "Blanco",
      stock: 500,
    });
  });

  it("strips uncurated fields (no stringified blobs leak through)", () => {
    const { clean } = normalizeProduct(SAMPLE_PRODUCT);
    const keys = Object.keys(clean).sort();
    expect(keys).toEqual([
      "description",
      "id",
      "name",
      "price",
      "reference",
      "variants",
    ]);
    // Variant shape is exactly the curated subset too.
    expect(Object.keys(clean.variants[0]!).sort()).toEqual([
      "colorHex",
      "colorName",
      "id",
      "packaging",
      "stock",
    ]);
  });
});

describe("normalizeProduct — malformed / edge cases", () => {
  it("falls back to sku when name is missing, with a warning", () => {
    const { clean, warnings } = normalizeProduct({ id: 1, sku: "NONAME" });
    expect(clean.name).toBe("NONAME");
    expect(warnings.some((w) => w.includes("no name"))).toBe(true);
  });

  it("warns and defaults when there is no positive price", () => {
    const { clean, warnings } = normalizeProduct({
      id: 2,
      sku: "FREE",
      regular_price: 0,
      sale_price: "0.00",
    });
    expect(clean.price).toContain("0");
    expect(warnings.some((w) => w.includes("no positive price"))).toBe(true);
  });

  it("defaults an unknown color's swatch to gray and warns", () => {
    const { clean, warnings } = normalizeProduct({
      id: 3,
      sku: "ODD",
      effective_price: "100",
      variations: [
        { id: 31, sku: "ODD-1", attributes: { Color: "Chartreuse" }, inventory: 5 },
      ],
    });
    expect(clean.variants[0]!.colorHex).toBe("#9e9e9e");
    expect(warnings.some((w) => w.includes("unknown color"))).toBe(true);
  });

  it("handles non-numeric inventory and missing color gracefully", () => {
    const { clean, warnings } = normalizeProduct({
      id: 4,
      sku: "WEIRD",
      effective_price: "100",
      variations: [{ id: 41, sku: "WEIRD-1", inventory: "not-a-number" }],
    });
    const v = clean.variants[0]!;
    expect(v.stock).toBe(0);
    expect(v.colorName).toBe("—");
    expect(warnings.some((w) => w.includes("inventory"))).toBe(true);
    expect(warnings.some((w) => w.includes("color name"))).toBe(true);
  });

  it("derives variant color from the name when attributes are absent", () => {
    const { clean } = normalizeProduct({
      id: 5,
      sku: "NAMED",
      effective_price: "100",
      variations: [
        { id: 51, sku: "NAMED-1", name: "Thing (Color: Azul)", inventory: 2 },
      ],
    });
    expect(clean.variants[0]!.colorName).toBe("Azul");
    expect(clean.variants[0]!.colorHex).toBe("#1e88e5");
  });

  it("throws when the required id/sku keys are missing", () => {
    expect(() => normalizeProduct({ name: "no keys" })).toThrow();
  });
});

describe("normalizeProducts — batch isolation", () => {
  it("skips unparseable records and records their index without failing the batch", () => {
    const { products, failedIndexes } = normalizeProducts([
      SAMPLE_PRODUCT,
      { name: "missing id and sku" },
      { id: 9, sku: "OK", effective_price: "5000" },
    ]);
    expect(products).toHaveLength(2);
    expect(failedIndexes).toEqual([1]);
    expect(products.map((p) => p.reference)).toEqual(["KIT002", "OK"]);
  });
});

describe("helpers", () => {
  it("parseMaybeJson parses JSON strings and passes through objects", () => {
    expect(__test.parseMaybeJson('["a","b"]')).toEqual(["a", "b"]);
    expect(__test.parseMaybeJson({ a: 1 })).toEqual({ a: 1 });
    expect(__test.parseMaybeJson("not json")).toBeUndefined();
  });

  it("toAmount coerces mixed number/string prices", () => {
    expect(__test.toAmount(19990)).toBe(19990);
    expect(__test.toAmount("19990.00")).toBe(19990);
    expect(__test.toAmount("0.00")).toBe(0);
    expect(__test.toAmount("abc")).toBeNull();
    expect(__test.toAmount(undefined)).toBeNull();
  });

  it("pickPrice prefers the first positive candidate", () => {
    expect(
      __test.pickPrice({ effective_price: "19990.00", regular_price: 0 }).found,
    ).toBe(true);
    expect(
      __test.pickPrice({ regular_price: 0, sale_price: "0.00" }).found,
    ).toBe(false);
  });
});
