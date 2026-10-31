/**
 * Global Vitest setup.
 *
 * Loaded for every test file (see `vitest.config.ts`). The jest-dom matchers
 * (`toBeInTheDocument`, etc.) only do anything under jsdom, but importing them
 * is harmless in the node environment. RTL cleanup after each test prevents
 * cross-test DOM leakage; it is a no-op when there is no DOM.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no ResizeObserver; several editor hooks (e.g. useCanvasStage)
// observe the canvas container. Provide a no-op stub so components mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
