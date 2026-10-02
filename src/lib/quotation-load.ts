/**
 * sessionStorage handoff for loading a saved quotation into the editor.
 *
 * The "My Quotations" page stashes the chosen quotation id here, then
 * navigates to the editor; the editor reads (and clears) it on mount and
 * fetches the full quotation via `quotation.byId`. We use sessionStorage
 * (not a URL param) because quotations are per-user and not meant to be
 * shared by link.
 */
const PENDING_LOAD_KEY = 'mm_pending_quotation_load'

/** Stash the id of a quotation to load, then navigate to the editor. */
export function setPendingQuotationLoad(id: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(PENDING_LOAD_KEY, id)
}

/** Read and clear the pending-load id (consume-once). */
export function takePendingQuotationLoad(): string | null {
  if (typeof window === 'undefined') return null
  const id = window.sessionStorage.getItem(PENDING_LOAD_KEY)
  if (id) window.sessionStorage.removeItem(PENDING_LOAD_KEY)
  return id
}
