"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Shared "is there an unsaved editor draft?" signal, so the nav bar (a sibling
 * of the editor page in the root layout) can guard draft-destroying in-app
 * navigations — something `beforeunload` cannot catch because client-side
 * route changes never unload the document.
 *
 * Backed by real state (not a ref) so the nav bar re-renders when the flag
 * flips and always reflects the editor's current value. The flag only changes
 * between false/true (not on every keystroke), so the re-render cost is
 * negligible, and state — unlike a ref — gives a single reactive source of
 * truth that survives editor remounts / tab duplication.
 */
interface EditorDraftContextValue {
  /** Whether the editor currently holds an unsaved draft. */
  isDraft: boolean;
  /** Publish the editor's current draft state (called by the editor page). */
  setIsDraft: (isDraft: boolean) => void;
}

const EditorDraftContext = createContext<EditorDraftContextValue | null>(null);

export function EditorDraftProvider({ children }: { children: ReactNode }) {
  const [isDraft, setIsDraft] = useState(false);
  const value = useMemo(() => ({ isDraft, setIsDraft }), [isDraft]);
  return (
    <EditorDraftContext.Provider value={value}>
      {children}
    </EditorDraftContext.Provider>
  );
}

/**
 * Access the editor-draft signal. Returns a safe default when used outside a
 * provider so consumers never need to null-check.
 */
export function useEditorDraft(): EditorDraftContextValue {
  const context = useContext(EditorDraftContext);
  return context ?? { isDraft: false, setIsDraft: () => undefined };
}
