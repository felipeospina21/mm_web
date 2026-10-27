import { describe, expect, it } from "vitest";

import {
  canRedo,
  canUndo,
  historyCommit,
  historyInit,
  historyRedo,
  historyUndo,
  type History,
} from "./history";

// Use plain strings as stand-in snapshots; the model is generic.
function init(): History<string> {
  return historyInit("a");
}

describe("history reducer", () => {
  it("initialises with a single baseline snapshot and no undo/redo", () => {
    const h = init();
    expect(h.stack).toEqual(["a"]);
    expect(h.index).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it("commit pushes and advances the cursor; enables undo, not redo", () => {
    const h = historyCommit(init(), "b");
    expect(h.stack).toEqual(["a", "b"]);
    expect(h.index).toBe(1);
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
  });

  it("undo moves back and returns the previous snapshot", () => {
    const h = historyCommit(init(), "b");
    const { history, snapshot } = historyUndo(h);
    expect(snapshot).toBe("a");
    expect(history.index).toBe(0);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(true);
  });

  it("undo at the baseline is a no-op (snapshot null)", () => {
    const h = init();
    const { history, snapshot } = historyUndo(h);
    expect(snapshot).toBeNull();
    expect(history).toBe(h);
  });

  it("redo moves forward and returns the next snapshot", () => {
    const committed = historyCommit(init(), "b");
    const undone = historyUndo(committed).history;
    const { history, snapshot } = historyRedo(undone);
    expect(snapshot).toBe("b");
    expect(history.index).toBe(1);
    expect(canRedo(history)).toBe(false);
  });

  it("redo at the newest snapshot is a no-op (snapshot null)", () => {
    const h = historyCommit(init(), "b");
    const { history, snapshot } = historyRedo(h);
    expect(snapshot).toBeNull();
    expect(history).toBe(h);
  });

  it("committing after an undo truncates the redo future (branch)", () => {
    // a -> b -> c, undo to b, then commit d: c is discarded.
    let h = historyCommit(init(), "b");
    h = historyCommit(h, "c");
    h = historyUndo(h).history; // at "b"
    expect(h.index).toBe(1);
    h = historyCommit(h, "d");
    expect(h.stack).toEqual(["a", "b", "d"]);
    expect(h.index).toBe(2);
    expect(canRedo(h)).toBe(false);
    expect(canUndo(h)).toBe(true);
  });

  it("supports multi-step undo/redo across a longer stack", () => {
    let h = init();
    h = historyCommit(h, "b");
    h = historyCommit(h, "c");
    h = historyCommit(h, "d"); // index 3

    const u1 = historyUndo(h);
    expect(u1.snapshot).toBe("c");
    const u2 = historyUndo(u1.history);
    expect(u2.snapshot).toBe("b");
    expect(canUndo(u2.history)).toBe(true);
    expect(canRedo(u2.history)).toBe(true);

    const r1 = historyRedo(u2.history);
    expect(r1.snapshot).toBe("c");
  });

  it("does not mutate the input history (immutable updates)", () => {
    const h = init();
    const committed = historyCommit(h, "b");
    expect(h.stack).toEqual(["a"]);
    expect(h.index).toBe(0);
    expect(committed).not.toBe(h);
  });
});
