// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

import { useCanvasStage } from "./use-canvas-stage";

function setup() {
  const onSelectionChange = vi.fn();
  const hook = renderHook(() =>
    useCanvasStage({
      pages: [],
      onActivePageChange: vi.fn(),
      onSelectionChange,
      scrollTopRef: { current: 0 },
    }),
  );
  return { ...hook, onSelectionChange };
}

describe("useCanvasStage selection", () => {
  it("does not notify on mount", () => {
    const { onSelectionChange } = setup();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("notifies the parent once per selection change", () => {
    const { result, onSelectionChange } = setup();
    act(() => result.current.setSelectedId("el-1"));
    expect(result.current.selectedId).toBe("el-1");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenLastCalledWith("el-1");
  });

  it("notifies null on deselect", () => {
    const { result, onSelectionChange } = setup();
    act(() => result.current.setSelectedId("el-1"));
    act(() => result.current.setSelectedId(null));
    expect(result.current.selectedId).toBeNull();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });
});
