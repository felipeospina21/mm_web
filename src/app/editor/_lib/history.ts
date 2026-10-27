/**
 * Pure, DOM-free undo/redo history model.
 *
 * The editor's quotation history is a stack of page-array snapshots plus a
 * cursor into it. This module holds the *stack math* (push with redo-branch
 * truncation, bounds-checked undo/redo, and the derived can-undo/can-redo
 * flags) as pure functions so it can be unit-tested without React or a DOM.
 * `use-quotation-history.ts` is a thin hook wrapper around these.
 *
 * Snapshots are stored by reference — callers pass already-immutable page
 * arrays (the editor never mutates a committed snapshot in place).
 */

export interface History<T> {
  /** Snapshot stack, oldest first. Always contains at least one entry. */
  readonly stack: readonly T[];
  /** Cursor into `stack`; `stack[index]` is the current snapshot. */
  readonly index: number;
}

/** Start a history with a single baseline snapshot. */
export function historyInit<T>(initial: T): History<T> {
  return { stack: [initial], index: 0 };
}

/**
 * Push a new snapshot. Any "redo future" ahead of the cursor is discarded
 * (a new edit after an undo branches off), then the cursor advances to the
 * new entry.
 */
export function historyCommit<T>(history: History<T>, next: T): History<T> {
  const truncated = history.stack.slice(0, history.index + 1);
  return { stack: [...truncated, next], index: truncated.length };
}

/**
 * Move the cursor back one step. Returns the unchanged history (and
 * `snapshot: null`) when already at the baseline.
 */
export function historyUndo<T>(history: History<T>): {
  history: History<T>;
  snapshot: T | null;
} {
  if (history.index <= 0) return { history, snapshot: null };
  const index = history.index - 1;
  return { history: { ...history, index }, snapshot: history.stack[index]! };
}

/**
 * Move the cursor forward one step. Returns the unchanged history (and
 * `snapshot: null`) when already at the newest snapshot.
 */
export function historyRedo<T>(history: History<T>): {
  history: History<T>;
  snapshot: T | null;
} {
  if (history.index >= history.stack.length - 1) {
    return { history, snapshot: null };
  }
  const index = history.index + 1;
  return { history: { ...history, index }, snapshot: history.stack[index]! };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.index > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.index < history.stack.length - 1;
}
