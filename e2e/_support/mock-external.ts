import type { Page, Route } from "@playwright/test";

/**
 * External-API mock for SKU lookup (Task 6.0).
 *
 * The app resolves SKUs through tRPC `product.resolveReferences`, wired with
 * `httpBatchStreamLink` + SuperJSON. We intercept the tRPC HTTP call and return
 * the resolver's `{ resolved, unresolved }` result directly, so no live
 * external aggregator is hit and the resolved/unresolved/malformed branches are
 * deterministic.
 *
 * Envelope notes (why this is the "primary, may need the fallback" technique):
 *   - Batched: the body is a batch; a single lookup is index "0".
 *   - SuperJSON: each result's data is wrapped as `{ json, meta? }`.
 *   - Streamed (`httpBatchStreamLink`): the non-streamed JSON array shape below
 *     works for a single-query batch; if a spec triggers multi-call batching or
 *     true streaming and matching gets fiddly, switch to the STUB-SERVER
 *     fallback (point EXTERNAL_API_BASE_URL at a local stub) behind this same
 *     helper signature so specs don't change.
 */

export interface MockVariant {
  id: string;
  colorName: string;
  colorHex: string;
  localInventory: number;
  zoneInventory: number;
  stock: number;
  packaging: string | null;
}

export interface MockProduct {
  id: string;
  name: string;
  reference: string;
  price: string;
  description: string;
  categories?: string[];
  imageUrl?: string | null;
  variants: MockVariant[];
}

export interface MockResolveResult {
  resolved: MockProduct[];
  unresolved: string[];
}

/**
 * Intercept `product.resolveReferences` and respond with the given result.
 * Matches the tRPC endpoint for that procedure; other tRPC calls fall through.
 */
export async function mockResolveReferences(
  page: Page,
  result: MockResolveResult,
): Promise<void> {
  await page.route("**/api/trpc/**", async (route: Route) => {
    const url = route.request().url();
    if (!url.includes("product.resolveReferences")) {
      return route.fallback();
    }

    // Non-streamed tRPC batch envelope for a single query at index 0, with the
    // SuperJSON data wrapper (no `meta` => plain values).
    const body = [
      {
        result: {
          data: {
            json: {
              resolved: result.resolved,
              unresolved: result.unresolved,
            },
          },
        },
      },
    ];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
