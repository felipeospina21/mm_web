// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";

import { setPendingQuotationClient } from "@/lib/quotation-load";
import { usePendingQuotationClient } from "./use-pending-quotation-client";

afterEach(() => {
  window.sessionStorage.clear();
});

describe("usePendingQuotationClient", () => {
  it("returns null when nothing was handed off", () => {
    const { result } = renderHook(() => usePendingQuotationClient());
    expect(result.current).toBeNull();
  });

  it("returns the client id stored by the home page", () => {
    setPendingQuotationClient("client-1", "contact-9");
    const { result } = renderHook(() => usePendingQuotationClient());
    expect(result.current).toBe("client-1");
  });

  it("renders null on the server even when storage has a value", () => {
    setPendingQuotationClient("client-1");
    function Probe() {
      return createElement("span", null, String(usePendingQuotationClient()));
    }
    expect(renderToString(createElement(Probe))).toContain("null");
  });
});
