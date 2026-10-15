/**
 * sessionStorage handoff for loading a saved quotation into the editor.
 *
 * The "My Quotations" page stashes the chosen quotation id here, then
 * navigates to the editor; the editor reads (and clears) it on mount and
 * fetches the full quotation via `quotation.byId`. We use sessionStorage
 * (not a URL param) because quotations are per-user and not meant to be
 * shared by link.
 */
const PENDING_LOAD_KEY = "mm_pending_quotation_load";
const DRAFT_CLIENT_KEY = "mm_draft_quotation_client";

/** Stash the id of a quotation to load, then navigate to the editor. */
export function setPendingQuotationLoad(id: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DRAFT_CLIENT_KEY);
  window.sessionStorage.setItem(PENDING_LOAD_KEY, id);
}

/** Read the pending-load id; clear it after its quotation row loads. */
export function takePendingQuotationLoad(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PENDING_LOAD_KEY);
}

/** Clear the saved-quotation handoff once its row has loaded. */
export function clearPendingQuotationLoad(id: string): void {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(PENDING_LOAD_KEY) === id) {
    window.sessionStorage.removeItem(PENDING_LOAD_KEY);
  }
}

/** Keep the home-selected client available while the draft is being edited. */
export function setPendingQuotationClient(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.sessionStorage.setItem(DRAFT_CLIENT_KEY, id);
  else window.sessionStorage.removeItem(DRAFT_CLIENT_KEY);
}

/** Read the draft client; keep it so a browser refresh can restore the draft. */
export function takePendingQuotationClient(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(DRAFT_CLIENT_KEY);
}
