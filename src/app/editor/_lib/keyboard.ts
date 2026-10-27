/**
 * Pure decision logic for the editor's global keyboard shortcuts.
 *
 * Kept free of the DOM so it can be unit-tested: the hook extracts the few
 * primitives it needs from the `KeyboardEvent` (key, modifier state, the focused
 * element's tag) plus whether a canvas element is currently selected, and this
 * function decides *what* should happen — the hook performs the side effects.
 *
 * Behaviour mirrors the original inline handler in `editor-client.tsx` exactly:
 *   - Cmd/Ctrl+Z        -> undo      (preventDefault)
 *   - Cmd/Ctrl+Shift+Z  -> redo      (preventDefault)
 *   - Delete/Backspace  -> delete the selected element, but only when focus is
 *                          not in an INPUT/TEXTAREA and something is selected;
 *                          preventDefault only when it actually deletes.
 *   - Cmd/Ctrl+D        -> duplicate the selected element; preventDefault is
 *                          applied unconditionally (even with nothing selected,
 *                          so the browser "bookmark" shortcut is always
 *                          suppressed inside the editor — preserved as-is).
 */

export type ShortcutActionType = "undo" | "redo" | "delete" | "duplicate";

export interface ShortcutInput {
  /** `event.key` */
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  /** `(event.target as HTMLElement)?.tagName`, if any. */
  targetTag: string | undefined;
  /** Whether a canvas element is currently selected. */
  hasSelection: boolean;
}

export interface ShortcutDecision {
  /** The action to dispatch, or `null` when the key combo is not a shortcut. */
  action: ShortcutActionType | null;
  /** Whether the hook should call `event.preventDefault()`. */
  preventDefault: boolean;
}

const NONE: ShortcutDecision = { action: null, preventDefault: false };

function isTypingTarget(targetTag: string | undefined): boolean {
  return targetTag === "INPUT" || targetTag === "TEXTAREA";
}

export function decideShortcut(input: ShortcutInput): ShortcutDecision {
  const { key, metaKey, ctrlKey, shiftKey, targetTag, hasSelection } = input;
  const mod = metaKey || ctrlKey;
  const lowerKey = key.toLowerCase();

  if (mod && lowerKey === "z") {
    return { action: shiftKey ? "redo" : "undo", preventDefault: true };
  }

  if (key === "Delete" || key === "Backspace") {
    // Never intercept while typing in a form field.
    if (isTypingTarget(targetTag)) return NONE;
    // Only act (and only preventDefault) when something is selected.
    if (hasSelection) return { action: "delete", preventDefault: true };
    return NONE;
  }

  if (mod && lowerKey === "d") {
    // preventDefault unconditionally (suppresses the browser bookmark shortcut),
    // but only duplicate when something is selected — preserved from the
    // original handler.
    return {
      action: hasSelection ? "duplicate" : null,
      preventDefault: true,
    };
  }

  return NONE;
}
