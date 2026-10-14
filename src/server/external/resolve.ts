import "server-only";

import type { QuotationProduct } from "@/lib/quotation-selection";
import { errorFields, log } from "@/server/observability/logger";

import { fetchProductsBySkus } from "./products";
import { normalizeProduct } from "./schema";

/** Outcome of a SKU lookup: products that normalized, and codes that didn't. */
export interface ResolveResult {
  resolved: QuotationProduct[];
  unresolved: string[];
}

/**
 * Resolve a (pre-cleaned) list of SKUs into clean {@link QuotationProduct}s.
 *
 * Wires the external API client (Epic 2) to the Zod firewall (Epic 3):
 *   1. batched `?skus=` fetch → raw products keyed by sku
 *   2. normalize each requested sku's payload
 *   3. split into `resolved` (normalized ok) and `unresolved` (not returned by
 *      the API, or returned but un-normalizable)
 *
 * `references` is expected to already be trimmed/de-duplicated (the tRPC input
 * schema and the client parser both do this). Matching against the API's
 * echoed `sku` is case-insensitive, but the resolved product carries the API's
 * canonical `reference`, not the user's casing.
 */
export async function resolveSkus(
  references: string[],
): Promise<ResolveResult> {
  if (references.length === 0) return { resolved: [], unresolved: [] };

  const startedAt = Date.now();
  let rawBySku: Map<string, unknown>;
  try {
    rawBySku = await fetchProductsBySkus(references);
  } catch (cause) {
    log.error("lookup.resolve", {
      requested: references.length,
      durationMs: Date.now() - startedAt,
      ok: false,
      ...errorFields(cause),
    });
    throw cause;
  }

  // Case-insensitive index so "kit002" matches an API "KIT002".
  const rawByLowerSku = new Map<string, unknown>();
  for (const [sku, raw] of rawBySku) {
    rawByLowerSku.set(sku.toLowerCase(), raw);
  }

  const resolved: QuotationProduct[] = [];
  const unresolved: string[] = [];

  for (const sku of references) {
    const raw = rawByLowerSku.get(sku.toLowerCase());
    if (raw === undefined) {
      unresolved.push(sku);
      continue;
    }
    try {
      // Per-product `warnings` are intentionally dropped here — the lookup
      // contract is resolved/unresolved; surfacing warnings is a later UI
      // concern.
      const { clean } = normalizeProduct(raw);
      resolved.push(clean);
    } catch {
      // Present but un-normalizable → unresolved.
      unresolved.push(sku);
    }
  }

  log.info("lookup.resolve", {
    requested: references.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    durationMs: Date.now() - startedAt,
    ok: true,
  });

  return { resolved, unresolved };
}
