// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import type { PageData } from "../_components/types";
import { useQuotationHistory } from "./use-quotation-history";

function page(id: string): PageData {
  return { id, pageNumber: 1, elements: [] };
}

function setup(initial: PageData[] = [page("a")]) {
  const onEdit = vi.fn();
  const view = renderHook(() =>
    useQuotationHistory({ initialPages: () => initial, onEdit }),
  );
  return { ...view, onEdit };
}

describe("useQuotationHistory", () => {
  it("starts with the initial pages and no undo/redo", () => {
    const { result } = setup();
    expect(result.current.pages).toEqual([page("a")]);
    expect(result.current.pagesRef.current).toEqual([page("a")]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("setPagesWithHistory commits a snapshot, enables undo, and fires onEdit", () => {
    const { result, onEdit } = setup();
    act(() => result.current.setPagesWithHistory([page("b")]));
    expect(result.current.pages).toEqual([page("b")]);
    expect(result.current.pagesRef.current).toEqual([page("b")]);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("accepts an updater function form", () => {
    const { result } = setup();
    act(() =>
      result.current.setPagesWithHistory((prev) => [...prev, page("b")]),
    );
    expect(result.current.pages.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("undo/redo move between snapshots and fire onEdit", () => {
    const { result, onEdit } = setup();
    act(() => result.current.setPagesWithHistory([page("b")]));
    onEdit.mockClear();

    act(() => result.current.undo());
    expect(result.current.pages).toEqual([page("a")]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(onEdit).toHaveBeenCalledTimes(1);

    act(() => result.current.redo());
    expect(result.current.pages).toEqual([page("b")]);
    expect(result.current.canRedo).toBe(false);
  });

  it("replacePages updates pages WITHOUT recording history or firing onEdit", () => {
    const { result, onEdit } = setup();
    act(() => result.current.replacePages([page("z")]));
    expect(result.current.pages).toEqual([page("z")]);
    expect(result.current.pagesRef.current).toEqual([page("z")]);
    expect(result.current.canUndo).toBe(false);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("resetHistory clears the undo/redo stack", () => {
    const { result } = setup();
    act(() => result.current.setPagesWithHistory([page("b")]));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.resetHistory([page("b")]));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
