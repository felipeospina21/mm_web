import { useEffect } from "react";
import type { RefObject } from "react";

import { decideShortcut } from "../_lib/keyboard";

interface UseEditorKeyboardShortcutsOptions {
  /** Ref holding the currently selected element id (set by the canvas). */
  selectedIdRef: RefObject<string | null>;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
}

/**
 * Wires the editor's global `keydown` shortcuts (undo/redo, delete, duplicate).
 *
 * This hook owns only the listener lifecycle and the side effects; the decision
 * of *what* each key combo does lives in the pure, unit-tested
 * `decideShortcut` helper in `_lib/keyboard.ts`.
 */
export function useEditorKeyboardShortcuts({
  selectedIdRef,
  onUndo,
  onRedo,
  onDeleteElement,
  onDuplicateElement,
}: UseEditorKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { action, preventDefault } = decideShortcut({
        key: e.key,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        targetTag: (e.target as HTMLElement | null)?.tagName,
        hasSelection: Boolean(selectedIdRef.current),
      });

      if (preventDefault) e.preventDefault();

      switch (action) {
        case "undo":
          onUndo();
          break;
        case "redo":
          onRedo();
          break;
        case "delete":
          if (selectedIdRef.current) onDeleteElement(selectedIdRef.current);
          break;
        case "duplicate":
          if (selectedIdRef.current) onDuplicateElement(selectedIdRef.current);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdRef, onUndo, onRedo, onDeleteElement, onDuplicateElement]);
}
