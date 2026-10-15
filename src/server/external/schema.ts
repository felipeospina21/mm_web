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
  café: "#6d4c41",
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

/** Minimal HTML entity decode for the entities common in these descriptions. */
function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&aacute;": "á",
    "&eacute;": "é",
    "&iacute;": "í",
    "&oacute;": "ó",
    "&uacute;": "ú",
    "&ntilde;": "ñ",
    "&uuml;": "ü",
    "&Aacute;": "Á",
    "&Eacute;": "É",
    "&Iacute;": "Í",
    "&Oacute;": "Ó",
    "&Uacute;": "Ú",
    "&Ntilde;": "Ñ",
    "&Uuml;": "Ü",
  };
  return text
    .replace(
      /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;|&aacute;|&eacute;|&iacute;|&oacute;|&uacute;|&ntilde;|&uuml;|&Aacute;|&Eacute;|&Iacute;|&Oacute;|&Uacute;|&Ntilde;|&Uuml;/g,
      (m) => named[m] ?? m,
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );
}

/**
 * Strip HTML markup from a rich-text string into clean plain text.
 *
 * The API returns `description` as HTML (e.g. `<p>Lorem…</p><ul><li>…</li>`).
 * The editor renders descriptions as Konva canvas text, which has no HTML
 * support, so the tags would show literally. We convert block-level breaks
 * (`</p>`, `<br>`, `</li>`, …) into newlines, drop every other tag, decode
 * entities, and collapse runs of whitespace — preserving paragraph structure
 * as `\n` which Konva text honors.
 */
export function stripHtml(input: string): string {
  if (!input) return "";
  let text = input;

  // List items → "• item"; block closers → newline; <br> → newline.
  text = text
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|tr|table)\s*>/gi, "\n");

  // Remove any remaining tags.
  text = text.replace(/<[^>]+>/g, "");

  // Decode entities, normalize whitespace, trim per-line, collapse blank runs.
  text = decodeEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Extract the first product image URL from the `images` field. The API may
 * return a plain array of URLs or the older object shape with `main_image`
 * and `gallery_images` arrays (sometimes JSON-encoded as a string). Returns
 * `null` when nothing usable is present.
 */
export function firstImageUrl(images: unknown): string | null {
  const parsed = parseMaybeJson(images);
  if (Array.isArray(parsed)) {
    const first = parsed.find(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
    return first ? first.trim() : null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  const pick = (key: string): string | null => {
    const arr = obj[key];
    if (Array.isArray(arr)) {
      const first = arr.find(
        (u): u is string => typeof u === "string" && u.trim().length > 0,
      );
      return first ? first.trim() : null;
    }
    return null;
  };

  return pick("main_image") ?? pick("gallery_images") ?? null;
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
  const candidates = [raw.effective_price, raw.regular_price, raw.sale_price];
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
    local_inventory: z.union([z.number(), z.string()]).optional(),
    zone_inventory: z.union([z.number(), z.string()]).optional(),
    attributes: z.unknown().optional(),
    variations: z.array(rawVariantSchema).nullish(),
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
 * Build a single inventory row from PRODUCT-level fields, for simple products
 * that have no `variations[]`. Color is a dash (there is no variant color).
 *
 * Stock for a simple product is `local_inventory + zone_inventory` (the
 * on-hand + nearby-zone availability), NOT the plain `inventory` field —
 * that distinction is specific to the no-variation case. Packaging comes from
 * the product's `packaging_type`. The row id is derived from the sku.
 */
function productLevelVariant(
  raw: z.infer<typeof rawProductSchema>,
  packaging: string | null,
): QuotationProductVariant {
  const local = toAmount(raw.local_inventory) ?? 0;
  const zone = toAmount(raw.zone_inventory) ?? 0;
  const stock = Math.max(0, Math.trunc(local + zone));
  return {
    id: `${raw.sku}-default`,
    colorName: "—",
    colorHex: DEFAULT_HEX,
    stock,
    packaging,
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

  const rawDescription =
    raw.description?.trim() ?? raw.short_description?.trim() ?? "";
  // Descriptions arrive as HTML; the editor renders plain Konva text.
  const description = stripHtml(rawDescription);

  const { price, found } = pickPrice(raw);
  if (!found) {
    warnings.push(
      `product ${reference} had no positive price — defaulted to ${price}`,
    );
  }

  const packaging = raw.packaging_type?.trim() ?? null;

  const imageUrl = firstImageUrl(raw.images);

  // Variable products carry `variations[]`; simple products do not — for those
  // we synthesize a single inventory row from the product-level `inventory`
  // and `packaging_type`, with a dash for color.
  const rawVariations = raw.variations ?? [];
  const variants: QuotationProductVariant[] =
    rawVariations.length > 0
      ? rawVariations.map((v, i) => normalizeVariant(v, packaging, i, warnings))
      : [productLevelVariant(raw, packaging)];

  const clean: QuotationProduct = {
    id: String(raw.id),
    name,
    reference,
    price,
    description,
    imageUrl,
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
  stripHtml,
  firstImageUrl,
  rawProductSchema,
};
