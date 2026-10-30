import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearPendingQuotationLoad,
  setPendingManualQuotation,
  setPendingQuotationClient,
  setPendingQuotationLoad,
  takePendingManualQuotation,
  takePendingQuotationClient,
  takePendingQuotationContact,
  takePendingQuotationLoad,
} from "./quotation-load";

/**
 * Minimal in-memory `sessionStorage` so these browser-only helpers can run in
 * the node test environment. Only the methods the module uses are implemented.
 */
function installSessionStorage(): void {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { sessionStorage };
}

beforeEach(() => {
  installSessionStorage();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/**
 * Regression guard for the home → editor client-data load.
 *
 * The editor seeds its "pending home client" ref from
 * `takePendingQuotationClient()` (not from the deferred `selectedClientId`
 * state, which is null on first render to avoid a hydration mismatch). If the
 * stored draft client/contact stopped round-tripping through sessionStorage,
 * the editor would silently drop the company/customer name on load — the bug
 * these tests exist to catch.
 */
describe("pending quotation draft client", () => {
  it("round-trips the client id and contact id", () => {
    setPendingQuotationClient("client-1", "contact-9");
    expect(takePendingQuotationClient()).toBe("client-1");
    expect(takePendingQuotationContact()).toBe("contact-9");
  });

  it("keeps the client id readable across repeated reads (not consumed)", () => {
    setPendingQuotationClient("client-1", "contact-9");
    // A browser refresh must still see the draft, so reads do NOT clear it.
    expect(takePendingQuotationClient()).toBe("client-1");
    expect(takePendingQuotationClient()).toBe("client-1");
    expect(takePendingQuotationContact()).toBe("contact-9");
  });

  it("stores the client id without a contact id when none is given", () => {
    setPendingQuotationClient("client-1");
    expect(takePendingQuotationClient()).toBe("client-1");
    expect(takePendingQuotationContact()).toBeNull();
  });

  it("clears a stale contact id when re-set without one", () => {
    setPendingQuotationClient("client-1", "contact-9");
    setPendingQuotationClient("client-2");
    expect(takePendingQuotationClient()).toBe("client-2");
    expect(takePendingQuotationContact()).toBeNull();
  });

  it("clears both client and contact when set to null", () => {
    setPendingQuotationClient("client-1", "contact-9");
    setPendingQuotationClient(null);
    expect(takePendingQuotationClient()).toBeNull();
    expect(takePendingQuotationContact()).toBeNull();
  });

  it("returns null before anything is stored", () => {
    expect(takePendingQuotationClient()).toBeNull();
    expect(takePendingQuotationContact()).toBeNull();
  });

  it("is dropped when a saved quotation is queued to load instead", () => {
    setPendingQuotationClient("client-1", "contact-9");
    setPendingQuotationLoad("quotation-7");
    // Loading a saved quotation and starting a draft-from-home are mutually
    // exclusive entry points, so queuing a load clears the draft client.
    expect(takePendingQuotationClient()).toBeNull();
    expect(takePendingQuotationLoad()).toBe("quotation-7");
  });
});

describe("pending quotation load id", () => {
  it("round-trips and is cleared only for the matching id", () => {
    setPendingQuotationLoad("quotation-7");
    expect(takePendingQuotationLoad()).toBe("quotation-7");

    clearPendingQuotationLoad("other-id");
    expect(takePendingQuotationLoad()).toBe("quotation-7");

    clearPendingQuotationLoad("quotation-7");
    expect(takePendingQuotationLoad()).toBeNull();
  });
});

describe("pending manual quotation", () => {
  it("is consumed once on read", () => {
    setPendingManualQuotation();
    expect(takePendingManualQuotation()).toBe(true);
    // One-shot: a second read is false, so a later blank editor isn't manual.
    expect(takePendingManualQuotation()).toBe(false);
  });

  it("is false when never set", () => {
    expect(takePendingManualQuotation()).toBe(false);
  });
});
