// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";

import type { PageData } from "../_components/types";

// --- tRPC mock -------------------------------------------------------------
// Capture the options the hook passes to useMutation (onSuccess/onError) and
// expose a controllable mutate + state so tests can drive the save lifecycle.
const mutate = vi.fn();
let capturedOptions: {
  networkMode?: string;
  onSuccess?: (result: unknown) => void;
  onError?: (error: {
    message: string;
    data?: {
      zodIssues?: Array<{
        path: Array<string | number>;
        code: string;
        maximum?: number;
      }> | null;
    } | null;
  }) => void;
} = {};
let mutationState = { isPending: false, data: undefined as unknown };

vi.mock("@/trpc/react", () => ({
  api: {
    quotation: {
      save: {
        useMutation: (options: typeof capturedOptions) => {
          capturedOptions = options;
          return { mutate, ...mutationState };
        },
      },
    },
  },
}));

import { useQuotationPersistence } from "./use-quotation-persistence";

function ref<T>(value: T): RefObject<T> {
  return { current: value };
}

const PAGES: PageData[] = [{ id: "p1", pageNumber: 1, elements: [] }];

function setup(
  overrides: Partial<Parameters<typeof useQuotationPersistence>[0]> = {},
) {
  const replacePages = vi.fn();
  const resetHistory = vi.fn();
  const setIsDirty = vi.fn();
  const onSaveError = vi.fn();
  const editRevisionRef = ref(0);
  const saveRevisionRef = ref(0);
  const options = {
    selectedClientId: "client-1",
    pagesRef: ref(PAGES),
    editRevisionRef,
    saveRevisionRef,
    canSaveWhen: true,
    replacePages,
    resetHistory,
    setIsDirty,
    onSaveError,
    ...overrides,
  };
  const view = renderHook(() => useQuotationPersistence(options));
  return {
    ...view,
    replacePages,
    resetHistory,
    setIsDirty,
    onSaveError,
    editRevisionRef,
    saveRevisionRef,
  };
}

describe("useQuotationPersistence", () => {
  beforeEach(() => {
    mutationState = { isPending: false, data: undefined };
    mutate.mockClear();
    capturedOptions = {};
  });
  afterEach(() => vi.clearAllMocks());

  it("gates canSave on a selected client", () => {
    expect(setup().result.current.canSave).toBe(true);
    expect(
      setup({ selectedClientId: null }).result.current.canSave,
    ).toBe(false);
  });

  it("gates canSave on canSaveWhen unless already saved", () => {
    // Not meaningful to save yet, and no saved identity => cannot save.
    expect(
      setup({ canSaveWhen: false }).result.current.canSave,
    ).toBe(false);
  });

  it("handleSave sends {id, clientId, data} and snapshots the revision", () => {
    const { result, editRevisionRef, saveRevisionRef } = setup();
    editRevisionRef.current = 7;
    act(() => result.current.handleSave());
    expect(mutate).toHaveBeenCalledWith({
      id: undefined,
      clientId: "client-1",
      data: PAGES,
    });
    expect(saveRevisionRef.current).toBe(7);
  });

  it("configures the save mutation to run even while offline", () => {
    setup();
    expect(capturedOptions.networkMode).toBe("always");
  });

  it("short-circuits with an offline message and does not dispatch when offline", () => {
    const onlineSpy = vi
      .spyOn(navigator, "onLine", "get")
      .mockReturnValue(false);
    const { result, onSaveError, saveRevisionRef } = setup();

    act(() => result.current.handleSave());

    expect(mutate).not.toHaveBeenCalled();
    expect(onSaveError).toHaveBeenCalledTimes(1);
    // Revision snapshot is untouched since no request went out.
    expect(saveRevisionRef.current).toBe(0);
    onlineSpy.mockRestore();
  });

  it("does not call mutate when it cannot save", () => {
    const { result } = setup({ selectedClientId: null });
    act(() => result.current.handleSave());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("onSuccess re-syncs canvas + history when no edits raced the save", () => {
    const { result, replacePages, resetHistory, setIsDirty } = setup();
    const savedDoc: PageData[] = [
      { id: "p1", pageNumber: 1, elements: [] },
    ];
    act(() => result.current.handleSave());
    act(() =>
      capturedOptions.onSuccess?.({
        id: "q-1",
        quotationNumber: "M10000",
        data: savedDoc,
      }),
    );
    expect(result.current.saved?.id).toBe("q-1");
    expect(result.current.saved?.quotationNumber).toBe("M10000");
    expect(replacePages).toHaveBeenCalledWith(savedDoc);
    expect(resetHistory).toHaveBeenCalledWith(savedDoc);
    expect(setIsDirty).toHaveBeenCalledWith(false);
  });

  it("onSuccess keeps in-flight edits: skips re-sync when the revision advanced", () => {
    const { result, replacePages, resetHistory, setIsDirty, editRevisionRef } =
      setup();
    act(() => result.current.handleSave()); // snapshots saveRevision = editRevision
    // Simulate an edit made while the request was in flight.
    editRevisionRef.current += 1;
    act(() =>
      capturedOptions.onSuccess?.({
        id: "q-1",
        quotationNumber: "M10000",
        data: PAGES,
      }),
    );
    // saved identity is still set...
    expect(result.current.saved?.id).toBe("q-1");
    expect(result.current.saved?.quotationNumber).toBe("M10000");
    // ...but the canvas/history/dirty re-sync is skipped to preserve edits.
    expect(replacePages).not.toHaveBeenCalled();
    expect(resetHistory).not.toHaveBeenCalled();
    expect(setIsDirty).not.toHaveBeenCalled();
  });

  it("onError reports a localized, mapped failure via the injected onSaveError", () => {
    const { onSaveError } = setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Unclassified error -> generic localized message with a shareable code,
    // NOT the raw error text (the old behaviour dumped `error.message`).
    act(() => capturedOptions.onError?.({ message: "boom" }));

    expect(onSaveError).toHaveBeenCalledTimes(1);
    const msg = onSaveError.mock.calls[0]![0] as string;
    expect(msg).not.toContain("boom");
    expect(msg).toContain("No se pudo guardar");
    // Full technical detail still goes to the console for developers.
    expect(consoleError).toHaveBeenCalledWith("Save failed:", { message: "boom" });
    consoleError.mockRestore();
  });

  it("onError maps a precise Zod issue to a field-specific message + code", () => {
    const { onSaveError } = setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    act(() =>
      capturedOptions.onError?.({
        message: "validation",
        data: {
          zodIssues: [
            { path: ["data", 13, "elements", 7, "id"], code: "too_big", maximum: 200 },
          ],
        },
      }),
    );

    const msg = onSaveError.mock.calls[0]![0] as string;
    expect(msg).toContain("QUOT-ID-TOO-LONG");
    expect(msg).toContain("200");
    consoleError.mockRestore();
  });
});
