import { useSyncExternalStore } from "react";

import { takePendingQuotationClient } from "@/lib/quotation-load";

/** The handoff value never changes while the editor is mounted. */
const subscribe = () => () => undefined;

/**
 * The client id handed off from the home page via `sessionStorage`.
 *
 * `null` on the server and during hydration, then the stored value: React
 * swaps from the server snapshot to the client snapshot after hydrating, so
 * server and first-client markup agree (no hydration mismatch) without a
 * set-state-in-effect.
 */
export function usePendingQuotationClient(): string | null {
  return useSyncExternalStore(
    subscribe,
    takePendingQuotationClient,
    () => null,
  );
}
