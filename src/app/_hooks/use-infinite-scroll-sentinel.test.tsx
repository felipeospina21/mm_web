// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useInfiniteScrollSentinel } from "./use-infinite-scroll-sentinel";

interface MockObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let observers: MockObserver[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observers.push({
          callback,
          options,
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Fire the most recent observer's callback with a given intersection state. */
function trigger(isIntersecting: boolean) {
  const observer = observers.at(-1)!;
  observer.callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

type Props = Parameters<typeof useInfiniteScrollSentinel>[0];

function render(overrides: Partial<Props> = {}) {
  const fetchNextPage = overrides.fetchNextPage ?? vi.fn();
  const node = document.createElement("div");
  // Assign the node inside the render body so it's present before the effect
  // runs (the effect reads `sentinelRef.current` on mount).
  const view = renderHook(
    (props: Props) => {
      const ref = useInfiniteScrollSentinel(props);
      ref.current = node;
      return ref;
    },
    {
      initialProps: {
        hasNextPage: true,
        isFetchingNextPage: false,
        fetchNextPage,
        ...overrides,
      } as Props,
    },
  );
  return { ...view, fetchNextPage };
}

describe("useInfiniteScrollSentinel", () => {
  it("does not observe when there is no next page", () => {
    render({ hasNextPage: false });
    expect(observers).toHaveLength(0);
  });

  it("observes with the default 200px rootMargin", () => {
    render();
    expect(observers.at(-1)?.options?.rootMargin).toBe("200px");
    expect(observers.at(-1)?.observe).toHaveBeenCalledTimes(1);
  });

  it("fetches the next page when the sentinel intersects", () => {
    const { fetchNextPage } = render();
    trigger(true);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not fetch while a fetch is already in flight", () => {
    const { fetchNextPage } = render({ isFetchingNextPage: true });
    trigger(true);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("does not fetch when the sentinel is not intersecting", () => {
    const { fetchNextPage } = render();
    trigger(false);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render();
    const observer = observers.at(-1)!;
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });
});
