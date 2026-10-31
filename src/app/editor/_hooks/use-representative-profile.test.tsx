// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RefObject } from "react";

import type { PageData, QuotationData } from "../_components/types";

let queryData: unknown = undefined;

vi.mock("@/trpc/react", () => ({
  api: {
    quotation: {
      representative: {
        useQuery: () => ({ data: queryData }),
      },
    },
  },
}));

import { useRepresentativeProfile } from "./use-representative-profile";

function ref<T>(value: T): RefObject<T> {
  return { current: value };
}

function pagesWithHeader(): PageData[] {
  return [
    {
      id: "p1",
      pageNumber: 1,
      elements: [
        {
          id: "representative-info",
          role: "representative-info",
          type: "text",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          text: "OLD",
          fontSize: 12,
          fill: "#000",
          isDraggable: false,
        },
        {
          id: "footer",
          role: "footer",
          type: "text",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          text: "OLD FOOTER",
          fontSize: 12,
          fill: "#000",
          isDraggable: false,
        },
      ],
    },
  ];
}

const REP = {
  name: "jane doe",
  phone: "111",
  phoneExt: 22,
  cellphone: "333",
  email: "jane@acme.test",
};

function setup(
  overrides: Partial<Parameters<typeof useRepresentativeProfile>[0]> = {},
) {
  const replacePages = vi.fn();
  const resetHistory = vi.fn();
  const metaRef = ref<QuotationData>({
    companyName: "",
    customerName: "",
    representativeName: "",
    representativePhone: "",
    representativePhoneExtension: "",
    representativeCellphone: "",
    representativeEmail: "",
    products: [],
  });
  const view = renderHook(() =>
    useRepresentativeProfile({
      isDirty: false,
      isSaved: false,
      pendingLoadId: null,
      pagesRef: ref(pagesWithHeader()),
      metaRef,
      replacePages,
      resetHistory,
      ...overrides,
    }),
  );
  return { ...view, replacePages, resetHistory, metaRef };
}

describe("useRepresentativeProfile", () => {
  beforeEach(() => {
    queryData = REP;
  });
  afterEach(() => vi.clearAllMocks());

  it("hydrates the representative + footer on a clean draft", () => {
    const { replacePages, resetHistory, metaRef } = setup();
    expect(replacePages).toHaveBeenCalledTimes(1);
    expect(resetHistory).toHaveBeenCalledTimes(1);

    const applied = replacePages.mock.calls[0]![0] as PageData[];
    const repEl = applied[0]!.elements.find(
      (e) => e.id === "representative-info",
    );
    // Name is capitalized and placed into the multi-line header text.
    expect(repEl!.text).toContain("Jane Doe");
    expect(repEl!.text).toContain("jane@acme.test");
    // meta is updated with the normalized profile.
    expect(metaRef.current.representativeName).toBe("Jane Doe");
    expect(metaRef.current.representativePhoneExtension).toBe("22");
  });

  it("does nothing when there is no profile data", () => {
    queryData = undefined;
    const { replacePages } = setup();
    expect(replacePages).not.toHaveBeenCalled();
  });

  it.each([
    ["dirty", { isDirty: true }],
    ["already saved", { isSaved: true }],
    ["a pending load", { pendingLoadId: "q-1" }],
  ])("skips hydration when %s", (_label, overrides) => {
    const { replacePages } = setup(overrides);
    expect(replacePages).not.toHaveBeenCalled();
  });
});
