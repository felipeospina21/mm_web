import { useCallback, useEffect, useRef, useState } from "react";

import { api, type RouterOutputs } from "@/trpc/react";
import { clearPendingQuotationLoad } from "@/lib/quotation-load";

export type QuotationRow = NonNullable<RouterOutputs["quotation"]["byId"]>;

interface UseQuotationLoadOptions {
  /**
   * Pending quotation id handed off from My Quotations (read once from
   * sessionStorage by the caller). `null` when there is nothing to load.
   */
  pendingLoadId: string | null;
  /** Whether the editor currently has unsaved changes. */
  isDirty: boolean;
  /**
   * Replace the editor contents with a loaded quotation. Owns the page
   * transforms + meta/client/saved side effects; kept in the caller because it
   * is editor-domain logic, not load plumbing.
   */
  hydrateFromRow: (row: QuotationRow) => void;
}

export interface QuotationLoad {
  /**
   * A loaded row awaiting user confirmation because applying it would discard
   * unsaved changes; `null` otherwise. Drives the confirm modal.
   */
  confirmLoad: QuotationRow | null;
  /** Apply the pending `confirmLoad` row (user confirmed overwrite). */
  acceptConfirmLoad: () => void;
  /** Dismiss the pending `confirmLoad` row (user declined). */
  dismissConfirmLoad: () => void;
}

/**
 * Orchestrates loading a saved quotation handed off from the My Quotations page
 * via sessionStorage (`pendingLoadId`): fetches it, applies it automatically
 * when the editor is clean, and—when the editor is dirty—exposes it as
 * `confirmLoad` so the caller can prompt before overwriting.
 *
 * Note: the entry point (My Quotations) is currently feature-flagged off, so in
 * the live app `pendingLoadId` is never set and the `byId` query stays disabled.
 * This hook is a behaviour-preserving extraction of the existing editor code.
 */
export function useQuotationLoad({
  pendingLoadId,
  isDirty,
  hydrateFromRow,
}: UseQuotationLoadOptions): QuotationLoad {
  const loadQuery = api.quotation.byId.useQuery(
    { id: pendingLoadId ?? "" },
    { enabled: !!pendingLoadId },
  );

  // When a dirty editor would be overwritten by a load, hold the row here
  // and show the confirm modal before applying it.
  const [dismissedLoadId, setDismissedLoadId] = useState<string | null>(null);
  const confirmLoad =
    isDirty && loadQuery.data && loadQuery.data.id !== dismissedLoadId
      ? loadQuery.data
      : null;

  // Apply the loaded quotation when clean. The dirty case is represented
  // directly by `confirmLoad`, so this effect does not mirror query state.
  const hydratedLoadIdRef = useRef<string | null>(null);
  useEffect(() => {
    const row = loadQuery.data;
    if (!row) return;
    clearPendingQuotationLoad(row.id);
    if (
      isDirty ||
      row.id === dismissedLoadId ||
      hydratedLoadIdRef.current === row.id
    ) {
      return;
    }
    hydratedLoadIdRef.current = row.id;
    hydrateFromRow(row);
  }, [loadQuery.data, isDirty, dismissedLoadId, hydrateFromRow]);

  const acceptConfirmLoad = useCallback(() => {
    if (!confirmLoad) return;
    hydratedLoadIdRef.current = confirmLoad.id;
    hydrateFromRow(confirmLoad);
    setDismissedLoadId(confirmLoad.id);
  }, [confirmLoad, hydrateFromRow]);

  const dismissConfirmLoad = useCallback(() => {
    if (confirmLoad) setDismissedLoadId(confirmLoad.id);
  }, [confirmLoad]);

  return { confirmLoad, acceptConfirmLoad, dismissConfirmLoad };
}
