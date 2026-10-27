import { describe, expect, it } from "vitest";

import { decideShortcut, type ShortcutInput } from "./keyboard";

function input(overrides: Partial<ShortcutInput> = {}): ShortcutInput {
  return {
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    targetTag: undefined,
    hasSelection: false,
    ...overrides,
  };
}

describe("decideShortcut", () => {
  describe("undo / redo", () => {
    it("Cmd+Z -> undo (preventDefault)", () => {
      expect(decideShortcut(input({ key: "z", metaKey: true }))).toEqual({
        action: "undo",
        preventDefault: true,
      });
    });

    it("Ctrl+Z -> undo (preventDefault)", () => {
      expect(decideShortcut(input({ key: "z", ctrlKey: true }))).toEqual({
        action: "undo",
        preventDefault: true,
      });
    });

    it("Cmd+Shift+Z -> redo (preventDefault)", () => {
      expect(
        decideShortcut(input({ key: "z", metaKey: true, shiftKey: true })),
      ).toEqual({ action: "redo", preventDefault: true });
    });

    it("is case-insensitive on the key (Z)", () => {
      expect(decideShortcut(input({ key: "Z", metaKey: true }))).toEqual({
        action: "undo",
        preventDefault: true,
      });
    });

    it("z without a modifier is not a shortcut", () => {
      expect(decideShortcut(input({ key: "z" }))).toEqual({
        action: null,
        preventDefault: false,
      });
    });
  });

  describe("delete / backspace", () => {
    it("Delete with a selection -> delete (preventDefault)", () => {
      expect(
        decideShortcut(input({ key: "Delete", hasSelection: true })),
      ).toEqual({ action: "delete", preventDefault: true });
    });

    it("Backspace with a selection -> delete (preventDefault)", () => {
      expect(
        decideShortcut(input({ key: "Backspace", hasSelection: true })),
      ).toEqual({ action: "delete", preventDefault: true });
    });

    it("Delete with no selection -> no-op, no preventDefault", () => {
      expect(
        decideShortcut(input({ key: "Delete", hasSelection: false })),
      ).toEqual({ action: null, preventDefault: false });
    });

    it("Delete while focused in an INPUT -> no-op even with a selection", () => {
      expect(
        decideShortcut(
          input({ key: "Delete", targetTag: "INPUT", hasSelection: true }),
        ),
      ).toEqual({ action: null, preventDefault: false });
    });

    it("Backspace while focused in a TEXTAREA -> no-op", () => {
      expect(
        decideShortcut(
          input({ key: "Backspace", targetTag: "TEXTAREA", hasSelection: true }),
        ),
      ).toEqual({ action: null, preventDefault: false });
    });
  });

  describe("duplicate (Cmd/Ctrl+D)", () => {
    it("Cmd+D with a selection -> duplicate (preventDefault)", () => {
      expect(
        decideShortcut(input({ key: "d", metaKey: true, hasSelection: true })),
      ).toEqual({ action: "duplicate", preventDefault: true });
    });

    it("Ctrl+D with a selection -> duplicate (preventDefault)", () => {
      expect(
        decideShortcut(input({ key: "d", ctrlKey: true, hasSelection: true })),
      ).toEqual({ action: "duplicate", preventDefault: true });
    });

    it("Cmd+D with NO selection -> no action but still preventDefault (preserved quirk)", () => {
      expect(
        decideShortcut(input({ key: "d", metaKey: true, hasSelection: false })),
      ).toEqual({ action: null, preventDefault: true });
    });

    it("d without a modifier is not a shortcut", () => {
      expect(decideShortcut(input({ key: "d", hasSelection: true }))).toEqual({
        action: null,
        preventDefault: false,
      });
    });
  });

  it("an unrelated key is never a shortcut", () => {
    expect(decideShortcut(input({ key: "a", metaKey: true }))).toEqual({
      action: null,
      preventDefault: false,
    });
  });
});
