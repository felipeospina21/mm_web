// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { PageData, TemplateElement } from "./types";

// Mock react-konva for BOTH this component and its CanvasPageRenderer/TableNode
// children: Konva nodes become DOM elements, refs are harmless no-ops.
vi.mock("react-konva", () => {
  const React = require("react") as typeof import("react");
  const node =
    (tag: string, marker: string) =>
    React.forwardRef(
      ({ text, children }: Record<string, unknown>, _ref: unknown) =>
        React.createElement(
          tag,
          { "data-konva": marker },
          text !== undefined ? String(text) : (children as React.ReactNode),
        ),
    );
  return {
    Stage: node("div", "stage"),
    Layer: node("div", "layer"),
    Transformer: node("div", "transformer"),
    Group: node("div", "group"),
    Rect: node("div", "rect"),
    Text: node("span", "text"),
    Image: node("div", "image"),
  };
});

import QuotationCanvas from "./quotation-canvas";

function page(elements: TemplateElement[]): PageData {
  return { id: "p1", pageNumber: 1, elements };
}

const textEl: TemplateElement = {
  id: "t1",
  type: "text",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  text: "Canvas Smoke",
  fontSize: 14,
  fill: "#000",
  isDraggable: true,
  isEditable: true,
};

function renderCanvas() {
  return render(
    <QuotationCanvas
      pages={[page([textEl])]}
      onElementChange={vi.fn()}
      onDeleteElement={vi.fn()}
      onDuplicateElement={vi.fn()}
      onSelectionChange={vi.fn()}
      onActivePageChange={vi.fn()}
      activePageNumber={1}
      onDeletePage={vi.fn()}
      onPasteImage={vi.fn()}
      onPasteElement={vi.fn()}
    />,
  );
}

describe("QuotationCanvas", () => {
  it("mounts and renders its page content without crashing", () => {
    expect(() => renderCanvas()).not.toThrow();
    expect(screen.getByText("Canvas Smoke")).toBeInTheDocument();
  });
});
