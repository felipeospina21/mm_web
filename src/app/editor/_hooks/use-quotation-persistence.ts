import { useCallback, useState } from "react";
import type { RefObject } from "react";

import { api, type RouterOutputs } from "@/trpc/react";
import type { PageData } from "../_components/types";
import { formatSaveError } from "../_lib/format-save-error";

/** Saved identity: `null` while a draft, populated once persisted. */
export interface SavedIdentity {
  id: string;
  quotationNumber: string;
}

interface UseQuotationPersistenceOptions {
  selectedClientId: string | null;
  /** Synchronous access to the current pages (for the save payload). */
  pagesRef: RefObject<PageData[]>;
  /** Edit revision at save time, used to detect edits made in-flight. */
  editRevisionRef: RefObject<number>;
  /** Snapshot of the edit revision taken when a save is dispatched. */
  saveRevisionRef: RefObject<number>;
  /**
   * Besides a selected client and an already-saved doc, the other conditions
   * that make a save meaningful (manual start / had initial products / dirty).
   * The hook ORs this with its own `saved`.
   */
  canSaveWhen: boolean;
  /** Sync the canvas + undo baseline to the server's saved result. */
  replacePages: (next: PageData[]) => void;
  resetHistory: (next: PageData[]) => void;
  setIsDirty: (dirty: boolean) => void;
  /**
   * Report a save failure to the user. Injected so this hook stays free of any
   * specific UI concern (was a blocking `alert`; now the app's toast). Receives
   * the already-localized message.
   */
  onSaveError: (message: string) => void;
}

export interface QuotationPersistence {
  /** Saved identity, or `null` for an unsaved draft. */
  saved: SavedIdentity | null;
  setSaved: (saved: SavedIdentity | null) => void;
  /** The full saved result (incl. clientName) for PDF naming, or undefined. */
  savedData: RouterOutputs["quotation"]["save"] | undefined;
  isSaving: boolean;
  canSave: boolean;
  handleSave: () => void;
}

/**
 * Owns the editor's persistence: the saved identity, the `quotation.save`
 * mutation, and the save action. On success it re-syncs the canvas and undo
 * baseline to the server's returned document (which carries the DB-assigned
 * number) via the injected history callbacks, keeping history concerns in the
 * history hook rather than here.
 */
export function useQuotationPersistence({
  selectedClientId,
  pagesRef,
  editRevisionRef,
  saveRevisionRef,
  canSaveWhen,
  replacePages,
  resetHistory,
  setIsDirty,
  onSaveError,
}: UseQuotationPersistenceOptions): QuotationPersistence {
  const [saved, setSaved] = useState<SavedIdentity | null>(null);

  const saveMutation = api.quotation.save.useMutation({
    // Default networkMode ("online") PAUSES a mutation while offline: it never
    // runs and never rejects, so the UI shows "Saving…" forever and onError
    // never fires. "always" makes the request actually attempt and fail fast
    // offline, so onError runs and the user gets feedback.
    networkMode: "always",
    onSuccess: (result) => {
      setSaved(result);
      // Keep edits made while this request was in flight; the response only
      // contains the earlier snapshot that was submitted.
      if (editRevisionRef.current !== saveRevisionRef.current) return;
      // The server returns the saved document with the number assigned by
      // the database. Keep the canvas and its undo baseline in sync with it.
      replacePages(result.data);
      resetHistory(result.data);
      setIsDirty(false);
    },
    onError: (error) => {
      // Full technical detail stays in the console for developers…
      console.error("Save failed:", error);
      // …while the user gets a readable, shareable message (field/limit + code).
      const { message } = formatSaveError(error);
      onSaveError(message);
    },
  });

  const canSave = Boolean(selectedClientId && (canSaveWhen || saved));

  const handleSave = useCallback(() => {
    if (!canSave || !selectedClientId) return;
    // Fast path: when the browser reports it's offline, give immediate feedback
    // instead of dispatching a request that can only fail. (networkMode:
    // "always" above still covers mid-flight drops and unreliable onLine.)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onSaveError(
        "Estás sin conexión. Conéctate a internet para guardar la cotización.",
      );
      return;
    }
    saveRevisionRef.current = editRevisionRef.current;
    saveMutation.mutate({
      id: saved?.id,
      clientId: selectedClientId,
      data: pagesRef.current,
    });
  }, [
    canSave,
    selectedClientId,
    saved?.id,
    saveMutation,
    pagesRef,
    editRevisionRef,
    saveRevisionRef,
    onSaveError,
  ]);

  return {
    saved,
    setSaved,
    savedData: saveMutation.data,
    isSaving: saveMutation.isPending,
    canSave,
    handleSave,
  };
}
