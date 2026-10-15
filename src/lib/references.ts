/**
 * Parse the raw product-reference (SKU) string a user types on the home page.
 *
 * The home page lets the user paste a comma-separated list of SKUs, e.g.
 * `"cp-10, au 20 4, xtron"`. This helper turns that into a clean array of
 * SKUs ready to send to the lookup:
 *   - split on commas
 *   - trim surrounding whitespace (inner spaces are kept — a SKU may contain
 *     them, e.g. "au 20 4")
 *   - drop empty entries (trailing commas, blank lines)
 *   - de-duplicate case-insensitively, keeping the FIRST occurrence's casing
 *   - preserve the order the user typed them in
 *
 * Framework-agnostic (no server-only / React imports) so both the client
 * input view and the server procedure can share it.
 */

/** Quiet safety cap; batching allows large lookups without exposing a UI limit. */
export const MAX_REFERENCES = 1000;

export function parseReferences(raw: string): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of raw.split(",")) {
    const sku = part.trim();
    if (sku.length === 0) continue;

    const key = sku.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(sku);
  }

  return out;
}
