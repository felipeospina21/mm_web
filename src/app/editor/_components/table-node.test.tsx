// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { TableData } from "./types";

// Mock react-konva: render Konva nodes as plain DOM so we can assert structure.
// - Text carries its content in a `text` prop (not children) -> render as span.
// - Rect/Group -> div, forwarding data-* attributes and a test marker.
vi.mock("react-konva", () => {
  const React = require("react") as typeof import("react");
  const node =
    (tag: string, marker: string) =>
    ({ text, children, ...props }: Record<string, unknown>) => {
      // Keep only DOM-safe attributes; drop Konva-only numeric/style props.
      const domProps: Record<string, unknown> = { "data-konva": marker };
      if (props["data-row"] !== undefined)
        domProps["data-row"] = props["data-row"];
      if (props["data-col"] !== undefined)
        domProps["data-col"] = props["data-col"];
      if (props.id) domProps.id = props.id as string;
      return React.createElement(
        tag,
        domProps,
        text !== undefined ? String(text) : (children as React.ReactNode),
      );
    };
  return {
    Group: node("div", "group"),
    Rect: node("div", "rect"),
    Text: node("span", "text"),
  };
});

import TableNode from "./table-node";

function table(): TableData {
  return {
    colWidths: [50, 50],
    rowHeight: 20,
    cells: [
      ["H0", "H1"],
      ["a0", "a1"],
    ],
    headerFill: "#000",
    headerColor: "#fff",
    borderColor: "#ccc",
    fontSize: 12,
  };
}

function renderNode(overrides: Partial<React.ComponentProps<typeof TableNode>> = {}) {
  const props: React.ComponentProps<typeof TableNode> = {
    id: "tbl-1",
    x: 0,
    y: 0,
    table: table(),
    isDraggable: true,
    isSelected: false,
    selectedRows: [],
    selectedColumns: [],
    selectedCells: [],
    onSelect: vi.fn(),
    onSelectRow: vi.fn(),
    onSelectColumn: vi.fn(),
    onSelectCell: vi.fn(),
    onDblClickCell: vi.fn(),
    onDragEnd: vi.fn(),
    onTransformEnd: vi.fn(),
    dragBoundFunc: (pos) => pos,
    onResizeColumn: vi.fn(),
    ...overrides,
  };
  return render(<TableNode {...props} />);
}

describe("TableNode", () => {
  it("renders every cell's text", () => {
    renderNode();
    expect(screen.getByText("H0")).toBeInTheDocument();
    expect(screen.getByText("H1")).toBeInTheDocument();
    expect(screen.getByText("a0")).toBeInTheDocument();
    expect(screen.getByText("a1")).toBeInTheDocument();
  });

  it("uses the element id on the group node (for the Transformer)", () => {
    const { container } = renderNode({ id: "my-table" });
    expect(container.querySelector("#my-table")).not.toBeNull();
  });

  it("renders more rects when selected (selection outline + resize handles)", () => {
    const { container: unselected } = renderNode({ isSelected: false });
    const baseRects = unselected.querySelectorAll('[data-konva="rect"]').length;

    const { container: selected } = renderNode({ isSelected: true });
    const selectedRects = selected.querySelectorAll('[data-konva="rect"]').length;

    // Selected adds the dashed outline + per-column resize handles.
    expect(selectedRects).toBeGreaterThan(baseRects);
  });
});
