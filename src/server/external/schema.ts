import "server-only";

import { z } from "zod";

import type {
  QuotationProduct,
  QuotationProductVariant,
} from "@/lib/quotation-selection";

/**
 * Zod contract firewall for the external product aggregator API.
 *
 * The upstream payload is messy: numbers arrive as strings and vice-versa,
 * `images` / `tags` / `printing_methods` are JSON *encoded as strings*,
 * product-level `attributes` is an array of objects while variant-level
 * `attributes` is a flat `{ Color: "Rojo" }` map, timestamps are non-ISO,
 * and there are dozens of fields we don't curate.
 *
 * This module validates defensively and transforms a raw product into the
 * clean {@link QuotationProduct} the editor consumes. It never throws on a
 * single bad field: anything suspicious is coerced to a safe default and a
 * human-readable note is pushed into `warnings`. Uncurated fields are dropped.
 */

/** Result of normalizing one product: the clean value plus any soft issues. */
export interface NormalizedProduct {
  clean: QuotationProduct;
  warnings: string[];
}

/** COP formatter — the editor renders prices as display strings. */
const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Minimal Spanish color-name → hex map so the inventory-table swatch is
 * meaningful. The API provides color *names*, never hex. Unknown names fall
 * back to a neutral gray (and raise a warning). Keys are compared lowercased.
 */
const COLOR_HEX: Record<string, string> = {
  rojo: "#e53935",
  azul: "#1e88e5",
  verde: "#43a047",
  amarillo: "#fdd835",
  negro: "#212121",
  blanco: "#fafafa",
  gris: "#9e9e9e",
  naranja: "#fb8c00",
  morado: "#8e24aa",
  rosa: "#ec407a",
  rosado: "#ec407a",
  cafe: "#6d4c41",
  "café": "#6d4c41",
  marron: "#6d4c41",
  beige: "#d7ccc8",
  dorado: "#c9a227",
  plateado: "#bdbdbd",
  turquesa: "#26c6da",
  fucsia: "#d81b60",
};

const DEFAULT_HEX = "#9e9e9e";

/**
 * Parse a value that is *either* already-parsed JSON or a JSON-encoded string.
 * Returns `undefined` (and lets the caller warn) when it can't be parsed.
 */
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Coerce a mixed number|string price to a finite number of pesos, or null.
 * Accepts 0, "0.00", "19990.00", 19990, etc. Non-numeric → null.
 */
function toAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Format a peso amount as a COP display string, e.g. "$19.990". */
function formatCop(amount: number): string {
  return copFormatter.format(amount);
}

/**
 * Pick the best price for a product/variant from the mixed price fields,
 * preferring the effective (actually-charged) price, then regular, then sale.
 * Returns the formatted string plus whether a usable price was found.
 */
function pickPrice(raw: {
  effective_price?: unknown;
  regular_price?: unknown;
  sale_price?: unknown;
}): { price: string; found: boolean } {
  const candidates = [
    raw.effective_price,
    raw.regular_price,
    raw.sale_price,
  ];
  for (const c of candidates) {
    const amount = toAmount(c);
    // Treat a real, positive amount as the price. 0 / "0.00" are placeholders
    // in this feed, so we keep looking for a non-zero candidate first.
    if (amount !== null && amount > 0) {
      return { price: formatCop(amount), found: true };
    }
  }
  // Nothing positive — fall back to 0 (formatted) and flag it.
  return { price: formatCop(0), found: false };
}

/** Resolve a color name to a hex swatch, warning on unknown names. */
function colorToHex(colorName: string, warnings: string[]): string {
  const key = colorName.trim().toLowerCase();
  const hex = COLOR_HEX[key];
  if (!hex) {
    warnings.push(`unknown color "${colorName}" — defaulted swatch to gray`);
    return DEFAULT_HEX;
  }
  return hex;
}

/**
 * Derive a variant color name from its flat `attributes` map (`{Color:"Rojo"}`)
 * or, failing that, from the variant name "... (Color: Rojo)". Case-insensitive
 * on the attribute key.
 */
function variantColorName(raw: {
  attributes?: unknown;
  name?: unknown;
}): string | null {
  if (raw.attributes && typeof raw.attributes === "object") {
    const entries = Object.entries(raw.attributes as Record<string, unknown>);
    const color = entries.find(([k]) => k.toLowerCase() === "color");
    if (color && typeof color[1] === "string" && color[1].trim()) {
      return color[1].trim();
    }
  }
  if (typeof raw.name === "string") {
    const m = /\(color:\s*([^)]+)\)/i.exec(raw.name);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/**
 * Loose variant schema: we accept almost anything and shape it in a transform,
 * so a malformed variant degrades gracefully instead of failing the product.
 */
const rawVariantSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    sku: z.string().optional(),
    name: z.string().optional(),
    inventory: z.union([z.number(), z.string()]).optional(),
    regular_price: z.unknown().optional(),
    sale_price: z.unknown().optional(),
    net_price: z.unknown().optional(),
    attributes: z.unknown().optional(),
  })
  .passthrough();

/**
 * Loose product schema. Only `id` + `sku` are truly required (they key the
 * record); everything else is optional and defended in the transform.
 */
const rawProductSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    sku: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    short_description: z.string().optional(),
    effective_price: z.unknown().optional(),
    regular_price: z.unknown().optional(),
    sale_price: z.unknown().optional(),
    packaging_type: z.string().optional(),
    inventory: z.union([z.number(), z.string()]).optional(),
    attributes: z.unknown().optional(),
    variations: z.array(rawVariantSchema).optional(),
    tags: z.unknown().optional(),
    images: z.unknown().optional(),
    printing_methods: z.unknown().optional(),
  })
  .passthrough();

export type RawProductInput = z.input<typeof rawProductSchema>;

/**
 * Normalize one external variant into a {@link QuotationProductVariant}.
 * `packaging` is inherited from the parent product (variants carry no
 * packaging field of their own). Warnings are appended to `warnings`.
 */
function normalizeVariant(
  raw: z.infer<typeof rawVariantSchema>,
  parentPackaging: string | null,
  index: number,
  warnings: string[],
): QuotationProductVariant {
  const id = raw.id !== undefined ? String(raw.id) : `variant-${index}`;
  if (raw.id === undefined) {
    warnings.push(`variant #${index} had no id — synthesized "${id}"`);
  }

  const colorName = variantColorName(raw) ?? "—";
  if (colorName === "—") {
    warnings.push(`variant ${raw.sku ?? id} had no resolvable color name`);
  }
  const colorHex =
    colorName === "—" ? DEFAULT_HEX : colorToHex(colorName, warnings);

  const stockAmount = toAmount(raw.inventory);
  const stock = stockAmount !== null ? Math.max(0, Math.trunc(stockAmount)) : 0;
  if (stockAmount === null && raw.inventory !== undefined) {
    warnings.push(
      `variant ${raw.sku ?? id} had non-numeric inventory — defaulted to 0`,
    );
  }

  return {
    id,
    colorName,
    colorHex,
    stock,
    packaging: parentPackaging,
  };
}

/**
 * Normalize a raw external product into a clean {@link QuotationProduct}.
 *
 * Returns `{ clean, warnings }`. Throws only when the input is so malformed it
 * lacks the required `id`/`sku` keys (a programmer/API contract error, not a
 * per-field data quirk) — callers typically skip such a record and record it
 * as "unresolved".
 */
export function normalizeProduct(input: unknown): NormalizedProduct {
  const warnings: string[] = [];
  const raw = rawProductSchema.parse(input);

  const reference = raw.sku;
  const name = raw.name?.trim() ?? reference;
  if (!raw.name?.trim()) {
    warnings.push(`product ${reference} had no name — fell back to sku`);
  }

  const description =
    raw.description?.trim() ?? raw.short_description?.trim() ?? "";

  const { price, found } = pickPrice(raw);
  if (!found) {
    warnings.push(
      `product ${reference} had no positive price — defaulted to ${price}`,
    );
  }

  const packaging = raw.packaging_type?.trim() ?? null;

  const variants: QuotationProductVariant[] = (raw.variations ?? []).map(
    (v, i) => normalizeVariant(v, packaging, i, warnings),
  );

  const clean: QuotationProduct = {
    id: String(raw.id),
    name,
    reference,
    price,
    description,
    variants,
  };

  return { clean, warnings };
}

/**
 * Normalize many raw products, isolating failures: a record missing the
 * required keys is skipped and its index recorded, rather than failing the
 * whole batch. Returns the clean products plus the merged warnings and the
 * indexes that could not be normalized at all.
 */
export function normalizeProducts(inputs: unknown[]): {
  products: QuotationProduct[];
  warnings: string[];
  failedIndexes: number[];
} {
  const products: QuotationProduct[] = [];
  const warnings: string[] = [];
  const failedIndexes: number[] = [];

  inputs.forEach((input, index) => {
    try {
      const { clean, warnings: w } = normalizeProduct(input);
      products.push(clean);
      warnings.push(...w);
    } catch {
      failedIndexes.push(index);
    }
  });

  return { products, warnings, failedIndexes };
}

/** Exported for unit tests. */
export const __test = {
  parseMaybeJson,
  toAmount,
  pickPrice,
  colorToHex,
  variantColorName,
  rawProductSchema,
};
