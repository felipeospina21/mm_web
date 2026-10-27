import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

import type { PageData } from "../_components/types";
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  historyCommit,
  historyInit,
  historyRedo,
  historyUndo,
  type History,
} from "../_lib/history";

type PagesUpdater = PageData[] | ((prev: PageData[]) => PageData[]);

interface UseQuotationHistoryOptions {
  /** Lazily-computed initial pages (passed as a factory to `useState`). */
  initialPages: () => PageData[];
  /**
   * Fired whenever an edit changes the current pages via history
   * (commit/undo/redo). The editor uses this to bump its save-race revision
   * and mark the document dirty — concerns kept out of this hook.
   */
  onEdit: () => void;
}

export interface QuotationHistory {
  pages: PageData[];
  /** Synchronous mirror of `pages` for callers that read during events. */
  pagesRef: RefObject<PageData[]>;
  canUndo: boolean;
  canRedo: boolean;
  /** Apply an edit and push a new history snapshot. Fires `onEdit`. */
  setPagesWithHistory: (updater: PagesUpdater) => void;
  /** Replace pages WITHOUT recording history (e.g. syncing a saved result). */
  replacePages: (next: PageData[]) => void;
  /** Reset the history baseline to `nextPages` (clears undo/redo). */
  resetHistory: (nextPages: PageData[]) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Owns the editor's `pages` state and its undo/redo snapshot stack, delegating
 * the stack math to the pure `_lib/history` reducer. Dirty/save concerns stay
 * in the caller via `onEdit`.
 */
export function useQuotationHistory({
  initialPages,
  onEdit,
}: UseQuotationHistoryOptions): QuotationHistory {
  const [pages, setPagesState] = useState<PageData[]>(initialPages);
  const pagesRef = useRef(pages);

  // Initialise from the `pages` state value (not `pagesRef`) so we don't read a
  // ref during render; at mount they are identical.
  const historyRef = useRef<History<PageData[]>>(historyInit(pages));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(canUndoOf(historyRef.current));
    setCanRedo(canRedoOf(historyRef.current));
  }, []);

  const replacePages = useCallback((next: PageData[]) => {
    pagesRef.current = next;
    setPagesState(next);
  }, []);

  const resetHistory = useCallback(
    (nextPages: PageData[]) => {
      historyRef.current = historyInit(nextPages);
      syncFlags();
    },
    [syncFlags],
  );

  const setPagesWithHistory = useCallback(
    (updater: PagesUpdater) => {
      const next =
        typeof updater === "function"
          ? updater(pagesRef.current)
          : updater;
      pagesRef.current = next;
      setPagesState(next);
      historyRef.current = historyCommit(historyRef.current, next);
      syncFlags();
      onEdit();
    },
    [onEdit, syncFlags],
  );

  const undo = useCallback(() => {
    const { history, snapshot } = historyUndo(historyRef.current);
    if (!snapshot) return;
    historyRef.current = history;
    pagesRef.current = snapshot;
    setPagesState(snapshot);
    syncFlags();
    onEdit();
  }, [onEdit, syncFlags]);

  const redo = useCallback(() => {
    const { history, snapshot } = historyRedo(historyRef.current);
    if (!snapshot) return;
    historyRef.current = history;
    pagesRef.current = snapshot;
    setPagesState(snapshot);
    syncFlags();
    onEdit();
  }, [onEdit, syncFlags]);

  return {
    pages,
    pagesRef,
    canUndo,
    canRedo,
    setPagesWithHistory,
    replacePages,
    resetHistory,
    undo,
    redo,
  };
}
