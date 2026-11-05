import type { Page, Route } from "@playwright/test";

/**
 * tRPC mocks for e2e specs (Tasks 6.0 / 6.1).
 *
 * The app talks to tRPC through `httpBatchStreamLink` + SuperJSON. The client
 * always parses the response as a JSONL *stream* (even though the server labels
 * it `content-type: application/json`), so a plain `[{ result: ... }]` batch
 * array is rejected and the query errors. The wire format below was captured
 * from a real `customer.list` response (6.1 spike):
 *
 *   {"json":{"0":[[0],[null,0,0]]}}                       index: proc 0 → chunk 0
 *   {"json":[0,0,[[{"result":0}],["result",0,1]]]}        chunk 0 = { result: →1 }
 *   {"json":[1,0,[[{"data":0}],["data",0,2]]]}            chunk 1 = { data:   →2 }
 *   {"json":[2,0,[[<DATA>]]]}                             chunk 2 = the payload
 *
 * Plain JSON payloads (strings/numbers/arrays/objects) need no SuperJSON `meta`.
 *
 * Scope: only SINGLE-procedure requests are fulfilled. A multi-procedure batch
 * (`/api/trpc/a,b`) falls through to the real server, as does any procedure we
 * don't mock. If a spec ever needs batched mocks, extend `streamBody` with one
 * chunk triplet per procedure (not verified), or use the stub-server fallback
 * (point `EXTERNAL_API_BASE_URL` at a local stub) behind this same helper API.
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

export interface MockClientContact {
  id: string;
  clientId: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** Shape of one `customer.list` row (see the `client.ts` router). */
export interface MockClient {
  id: string;
  name: string;
  companyId: string | null;
  userAlias: string | null;
  address: string | null;
  phone: string | null;
  contacts: MockClientContact[];
}

/** Procedure names in a tRPC URL, e.g. `/api/trpc/a,b?batch=1` → [a, b]. */
function proceduresOf(url: string): string[] {
  const { pathname } = new URL(url);
  const tail = pathname.split("/api/trpc/")[1] ?? "";
  return tail.split(",").filter(Boolean);
}

/** JSONL stream body for one successful single-procedure result. */
function streamBody(data: unknown): string {
  return (
    [
      { json: { "0": [[0], [null, 0, 0]] } },
      { json: [0, 0, [[{ result: 0 }], ["result", 0, 1]]] },
      { json: [1, 0, [[{ data: 0 }], ["data", 0, 2]]] },
      { json: [2, 0, [[data]]] },
    ]
      .map((line) => JSON.stringify(line))
      .join("\n") + "\n"
  );
}

/**
 * Fulfill single-procedure tRPC calls for the procedures in `data` with fixed
 * results. Everything else falls through (`route.fallback`) to the next
 * handler / the real server.
 */
async function mockProcedures(
  page: Page,
  data: Record<string, unknown>,
): Promise<void> {
  await page.route("**/api/trpc/**", async (route: Route) => {
    const procedures = proceduresOf(route.request().url());
    const [only] = procedures;
    if (procedures.length !== 1 || only === undefined || !(only in data)) {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: streamBody(data[only]),
    });
  });
}

/** Intercept `product.resolveReferences` (the only external-API path). */
export async function mockResolveReferences(
  page: Page,
  result: MockResolveResult,
): Promise<void> {
  await mockProcedures(page, {
    "product.resolveReferences": {
      resolved: result.resolved,
      unresolved: result.unresolved,
    },
  });
}

/**
 * Intercept `customer.list` so the client picker needs no DB rows. Keeps the
 * lookup-flow specs write-free (Task 6.1).
 */
export async function mockClientList(
  page: Page,
  clients: MockClient[],
): Promise<void> {
  await mockProcedures(page, { "customer.list": clients });
}
