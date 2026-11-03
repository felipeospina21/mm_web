// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { ToastProvider, useToast } from "./toast-context";

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe("useToast outside a provider", () => {
  it("returns safe no-op defaults", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.showToast("x")).toBe(-1);
    expect(result.current.showError("x")).toBe(-1);
    // dismiss is a no-op; should not throw
    expect(() => result.current.dismiss(0)).not.toThrow();
  });
});

describe("ToastProvider", () => {
  afterEach(() => vi.useRealTimers());

  it("renders an error toast with an assertive alert role", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showError("Save failed");
    });
    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Save failed");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("errors do not auto-dismiss; info auto-dismisses after the delay", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showError("stays");
      result.current.showToast("goes", "info", { durationMs: 1000 });
    });
    expect(screen.getByText("stays")).toBeInTheDocument();
    expect(screen.getByText("goes")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The auto-dismiss fires, then the exit animation plays out before removal.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText("stays")).toBeInTheDocument();
    expect(screen.queryByText("goes")).not.toBeInTheDocument();
  });

  it("dismiss removes a toast by id (after the exit animation)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });
    let id = -1;
    act(() => {
      id = result.current.showError("bye");
    });
    expect(screen.getByText("bye")).toBeInTheDocument();
    act(() => result.current.dismiss(id));
    // Exit animation is in flight; the node is still mounted until it finishes.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText("bye")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
  });
});
