// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { t } from "@/i18n/messages";
import type { PageData, TemplateElement } from "./types";
import FloatingToolbar from "./floating-toolbar";

function el(overrides: Partial<TemplateElement>): TemplateElement {
  return {
    id: "el-1",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    text: "hi",
    fontSize: 12,
    fill: "#000000",
    isDraggable: true,
    isEditable: true,
    ...overrides,
  };
}

function pages(element: TemplateElement): PageData[] {
  return [{ id: "p1", pageNumber: 1, elements: [element] }];
}

function renderToolbar(
  element: TemplateElement,
  props: Partial<React.ComponentProps<typeof FloatingToolbar>> = {},
) {
  const onElementChange = vi.fn();
  const onDeleteElement = vi.fn();
  const onDuplicateElement = vi.fn();
  const onClearSelectedRows = vi.fn();
  render(
    <FloatingToolbar
      pages={pages(element)}
      selectedId={element.id}
      onElementChange={onElementChange}
      onDeleteElement={onDeleteElement}
      onDuplicateElement={onDuplicateElement}
      selectedRows={[]}
      onClearSelectedRows={onClearSelectedRows}
      {...props}
    />,
  );
  return {
    onElementChange,
    onDeleteElement,
    onDuplicateElement,
    onClearSelectedRows,
  };
}

describe("FloatingToolbar", () => {
  it("renders nothing when the selected element is not editable", () => {
    const { container } = render(
      <FloatingToolbar
        pages={pages(el({ isEditable: false, isRowDeletable: false }))}
        selectedId="el-1"
        onElementChange={vi.fn()}
        onDeleteElement={vi.fn()}
        onDuplicateElement={vi.fn()}
        selectedRows={[]}
        onClearSelectedRows={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("always offers duplicate and delete for an editable element", () => {
    renderToolbar(el({ type: "text" }));
    expect(
      screen.getByTitle(t("toolbar.duplicate")),
    ).toBeInTheDocument();
    expect(screen.getByTitle(t("toolbar.delete"))).toBeInTheDocument();
  });

  it("fires delete / duplicate with the element id", async () => {
    const user = userEvent.setup();
    const { onDeleteElement, onDuplicateElement } = renderToolbar(
      el({ id: "abc", type: "text" }),
    );
    await user.click(screen.getByTitle(t("toolbar.duplicate")));
    await user.click(screen.getByTitle(t("toolbar.delete")));
    expect(onDuplicateElement).toHaveBeenCalledWith("abc");
    expect(onDeleteElement).toHaveBeenCalledWith("abc");
  });

  it("shows an image file input for an image element", () => {
    const { container } = render(
      <FloatingToolbar
        pages={pages(el({ type: "image", text: "" }))}
        selectedId="el-1"
        onElementChange={vi.fn()}
        onDeleteElement={vi.fn()}
        onDuplicateElement={vi.fn()}
        selectedRows={[]}
        onClearSelectedRows={vi.fn()}
      />,
    );
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute("accept", "image/*");
  });
});
