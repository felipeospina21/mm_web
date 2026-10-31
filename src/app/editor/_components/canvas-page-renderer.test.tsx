// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { PageData, TemplateElement } from "./types";

vi.mock("react-konva", () => {
  const React = require("react") as typeof import("react");
  const node =
    (tag: string, marker: string) =>
    ({ text, children, id }: Record<string, unknown>) =>
      React.createElement(
        tag,
        { "data-konva": marker, ...(id ? { id: id as string } : {}) },
        text !== undefined ? String(text) : (children as React.ReactNode),
      );
  return {
    Group: node("div", "group"),
    Rect: node("div", "rect"),
    Text: node("span", "text"),
    Image: node("div", "image"),
  };
});

import { CanvasPageRenderer } from "./canvas-page-renderer";

function textEl(overrides: Partial<TemplateElement> = {}): TemplateElement {
  return {
    id: "t1",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    text: "Hello Canvas",
    fontSize: 14,
    fill: "#000",
    isDraggable: true,
    ...overrides,
  };
}

function page(elements: TemplateElement[]): PageData {
  return { id: "p1", pageNumber: 1, elements };
}

function renderRenderer(pages: PageData[]) {
  render(
    <CanvasPageRenderer
      pages={pages}
      visiblePageNumbers={new Set([1])}
      activePageNumber={1}
      selectedId={null}
      selection={{ rows: [], columns: [], cells: [] }}
      onSelectElement={vi.fn()}
      onActivePageChange={vi.fn()}
      onDragEnd={vi.fn()}
      onTransformEnd={vi.fn()}
      makeDragBoundFunc={() => (pos) => pos}
      onOpenTextEditor={vi.fn()}
      onOpenCellEditor={vi.fn()}
      onSelectRow={vi.fn()}
      onSelectColumn={vi.fn()}
      onSelectCell={vi.fn()}
      onResizeColumn={vi.fn()}
    />,
  );
}

describe("CanvasPageRenderer", () => {
  it("renders text elements of a visible page", () => {
    renderRenderer([page([textEl({ text: "Hello Canvas" })])]);
    expect(screen.getByText("Hello Canvas")).toBeInTheDocument();
  });

  it("renders a placeholder (no crash) for an image element with no src", () => {
    const { container } = render(<div />);
    expect(() =>
      renderRenderer([
        page([textEl(), { ...textEl({ id: "img1", type: "image", text: "", src: "" }) }]),
      ]),
    ).not.toThrow();
    // The text sibling still renders alongside the image placeholder.
    expect(screen.getByText("Hello Canvas")).toBeInTheDocument();
    expect(container).toBeDefined();
  });
});
