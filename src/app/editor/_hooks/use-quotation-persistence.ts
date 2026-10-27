import { useCallback, useState } from "react";
import type { RefObject } from "react";

import { api, type RouterOutputs } from "@/trpc/react";
import { t } from "@/i18n/messages";
import type { PageData } from "../_components/types";

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
}: UseQuotationPersistenceOptions): QuotationPersistence {
  const [saved, setSaved] = useState<SavedIdentity | null>(null);

  const saveMutation = api.quotation.save.useMutation({
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
      console.error("Save failed:", error);
      alert(t("editor.saveFailed", { error: error.message }));
    },
  });

  const canSave = Boolean(selectedClientId && (canSaveWhen || saved));

  const handleSave = useCallback(() => {
    if (!canSave || !selectedClientId) return;
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
