import "server-only";

import { externalGet } from "./client";

/**
 * SKU batch lookup against the external product API.
 *
 * This module owns the transport concern only: chunk the requested SKUs into
 * batches the API accepts, call the endpoint, and return the raw product
 * payloads keyed by SKU. It does NOT validate or normalize the payload — the
 * Zod firewall (next epic) turns these raw objects into clean domain types.
 */

/** The external API accepts at most this many SKUs per `?skus=` request. */
export const MAX_SKUS_PER_REQUEST = 20;

/**
 * Raw product object as returned by the API. Only the fields we rely on for
 * keying are typed; everything else is passthrough for the Zod firewall to
 * pick from. Intentionally loose — do not treat this as validated.
 */
export interface RawExternalProduct {
  /** Stable numeric id. */
  id: number;
  /** Product-level SKU — the key the user searches by. */
  sku: string;
  [key: string]: unknown;
}

/** The `/products` response envelope. */
interface ProductsResponse {
  success: boolean;
  message: string;
  data: {
    products: RawExternalProduct[];
    pagination?: unknown;
  };
}

/** Split an array into chunks of at most `size`. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Fetch raw product payloads for the given SKUs.
 *
 * Issues `GET /products?skus=a,b,c` (comma-joined, URL-encoded by the client),
 * chunking into batches of {@link MAX_SKUS_PER_REQUEST} and merging the
 * responses. Returns a map keyed by the product-level `sku`. A requested SKU
 * that the API does not return is simply absent from the map (the caller
 * computes "unresolved").
 *
 * The input is de-duplicated defensively; empty input short-circuits to an
 * empty map without hitting the network.
 */
export async function fetchProductsBySkus(
  skus: string[],
): Promise<Map<string, RawExternalProduct>> {
  const unique = Array.from(
    new Set(skus.map((s) => s.trim()).filter((s) => s.length > 0)),
  );

  const result = new Map<string, RawExternalProduct>();
  if (unique.length === 0) return result;

  const batches = chunk(unique, MAX_SKUS_PER_REQUEST);

  // Batches run sequentially to stay gentle on the external API and keep the
  // retry/backoff behavior predictable; the expected request count is small.
  for (const batch of batches) {
    const res = await externalGet<ProductsResponse>("/products", {
      query: { skus: batch.join(",") },
    });

    for (const product of res.data?.products ?? []) {
      if (product?.sku) result.set(product.sku, product);
    }
  }

  return result;
}
