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
  onSuccess?: (result: unknown) => void;
  onError?: (error: { message: string }) => void;
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

// Avoid alert noise / undefined in jsdom when onError runs.
vi.stubGlobal("alert", vi.fn());

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
    ...overrides,
  };
  const view = renderHook(() => useQuotationPersistence(options));
  return {
    ...view,
    replacePages,
    resetHistory,
    setIsDirty,
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
});
