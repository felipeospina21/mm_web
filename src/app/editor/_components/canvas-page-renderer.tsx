"use client";

import { Group, Rect, Text, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import { useCallback, useEffect, useState } from "react";
import TableNode from "./table-node";
import type { PageData, TemplateElement } from "./types";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./types";
import { getPageOffset } from "../_lib/quotation-canvas-geometry";
import { isAllowedImageSrc } from "./quotation-schema";
import { theme } from "@/lib/theme";
import { t } from "@/i18n/messages";

export interface CanvasSelection {
  rows: number[];
  columns: number[];
  cells: Array<{ row: number; col: number }>;
}

export interface CanvasPageRendererProps {
  pages: PageData[];
  visiblePageNumbers: Set<number>;
  activePageNumber: number;
  selectedId: string | null;
  selection: CanvasSelection;
  onSelectElement: (elementId: string, pageNumber: number) => void;
  onActivePageChange: (pageNumber: number) => void;
  onDragEnd: (pageId: string, event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (
    pageId: string,
    event: Konva.KonvaEventObject<Event>,
  ) => void;
  makeDragBoundFunc: (
    page: PageData,
    element: TemplateElement,
  ) => (pos: Konva.Vector2d) => Konva.Vector2d;
  onOpenTextEditor: (page: PageData, element: TemplateElement) => void;
  onOpenCellEditor: (
    page: PageData,
    element: TemplateElement,
    row: number,
    col: number,
  ) => void;
  onSelectRow: (
    elementId: string,
    pageNumber: number,
    row: number,
    extend: boolean,
  ) => void;
  onSelectColumn: (
    elementId: string,
    pageNumber: number,
    column: number,
    extend: boolean,
  ) => void;
  onSelectCell: (
    elementId: string,
    pageNumber: number,
    row: number,
    col: number,
    extend: boolean,
  ) => void;
}

export function CanvasPageRenderer({
  pages,
  visiblePageNumbers,
  activePageNumber,
  selectedId,
  selection,
  onSelectElement,
  onActivePageChange,
  onDragEnd,
  onTransformEnd,
  makeDragBoundFunc,
  onOpenTextEditor,
  onOpenCellEditor,
  onSelectRow,
  onSelectColumn,
  onSelectCell,
}: CanvasPageRendererProps) {
  return (
    <>
      {pages
        .filter((page) => visiblePageNumbers.has(page.pageNumber))
        .map((page) => (
          <CanvasPage
            key={page.id}
            page={page}
            activePageNumber={activePageNumber}
            selectedId={selectedId}
            selection={selection}
            onSelectElement={onSelectElement}
            onActivePageChange={onActivePageChange}
            onDragEnd={onDragEnd}
            onTransformEnd={onTransformEnd}
            makeDragBoundFunc={makeDragBoundFunc}
            onOpenTextEditor={onOpenTextEditor}
            onOpenCellEditor={onOpenCellEditor}
            onSelectRow={onSelectRow}
            onSelectColumn={onSelectColumn}
            onSelectCell={onSelectCell}
          />
        ))}
    </>
  );
}

function CanvasPage(
  props: Omit<CanvasPageRendererProps, "pages" | "visiblePageNumbers"> & {
    page: PageData;
  },
) {
  const {
    page,
    activePageNumber,
    selectedId,
    selection,
    onSelectElement,
    onActivePageChange,
    onDragEnd,
    onTransformEnd,
    makeDragBoundFunc,
    onOpenTextEditor,
    onOpenCellEditor,
    onSelectRow,
    onSelectColumn,
    onSelectCell,
  } = props;
  const offset = getPageOffset(page.pageNumber);
  return (
    <Group
      onMouseDown={() => onActivePageChange(page.pageNumber)}
      onTouchStart={() => onActivePageChange(page.pageNumber)}
    >
      <Rect
        x={offset.x}
        y={offset.y}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
        fill="#ffffff"
        shadowColor="black"
        shadowBlur={20}
        shadowOpacity={0.4}
        shadowOffset={{ x: 0, y: 6 }}
        cornerRadius={2}
        listening={false}
      />
      {page.pageNumber === activePageNumber && (
        <Rect
          x={offset.x - 3}
          y={offset.y - 3}
          width={PAGE_WIDTH + 6}
          height={PAGE_HEIGHT + 6}
          stroke={theme.colors.primary}
          strokeWidth={3}
          listening={false}
        />
      )}
      {page.elements.map((element) => {
        const absX = offset.x + element.x;
        const absY = offset.y + element.y;
        const select = () => {
          onSelectElement(element.id, page.pageNumber);
        };
        const commonProps = {
          id: element.id,
          x: absX,
          y: absY,
          draggable: element.isDraggable,
          dragBoundFunc: makeDragBoundFunc(page, element),
          onMouseDown: select,
          onTouchStart: select,
          onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
            onDragEnd(page.id, event),
          onDblClick: () => {
            if (element.type === "text" && element.isEditable)
              onOpenTextEditor(page, element);
          },
          onDblTap: () => {
            if (element.type === "text" && element.isEditable)
              onOpenTextEditor(page, element);
          },
        };
        if (element.type === "table" && element.table)
          return (
            <TableNode
              key={element.id}
              id={element.id}
              x={absX}
              y={absY}
              table={element.table}
              isDraggable={element.isDraggable}
              isSelected={selectedId === element.id}
              selectedRows={selectedId === element.id ? selection.rows : []}
              selectedColumns={
                selectedId === element.id ? selection.columns : []
              }
              selectedCells={selectedId === element.id ? selection.cells : []}
              onSelect={select}
              onSelectRow={(row, extend) =>
                onSelectRow(element.id, page.pageNumber, row, extend)
              }
              onSelectColumn={(column, extend) =>
                onSelectColumn(element.id, page.pageNumber, column, extend)
              }
              onSelectCell={(row, col, extend) =>
                onSelectCell(element.id, page.pageNumber, row, col, extend)
              }
              onDblClickCell={(row, col) => {
                if (element.isEditable)
                  onOpenCellEditor(page, element, row, col);
              }}
              onDragEnd={(event) => onDragEnd(page.id, event)}
              onTransformEnd={(event) => onTransformEnd(page.id, event)}
              dragBoundFunc={makeDragBoundFunc(page, element)}
            />
          );
        if (element.type === "image")
          return (
            <ImageElement
              key={element.id}
              element={element}
              {...commonProps}
              onTransformEnd={(event: Konva.KonvaEventObject<Event>) =>
                onTransformEnd(page.id, event)
              }
            />
          );
        if (element.type === "rect")
          return (
            <Rect
              key={element.id}
              {...commonProps}
              width={element.width}
              height={element.height}
              fill={element.fill}
              onTransformEnd={(event) => onTransformEnd(page.id, event)}
            />
          );
        return (
          <Text
            key={element.id}
            {...commonProps}
            width={element.width}
            height={element.height}
            text={element.text}
            fontSize={element.fontSize}
            lineHeight={element.lineHeight}
            fill={element.fill}
            fontFamily={element.fontFamily ?? "Arial"}
            fontStyle={
              [
                element.fontWeight === "bold" ? "bold" : "",
                element.italic ? "italic" : "",
              ]
                .filter(Boolean)
                .join(" ") || "normal"
            }
            textDecoration={element.underline ? "underline" : "normal"}
            onTransformEnd={(event) => onTransformEnd(page.id, event)}
          />
        );
      })}
    </Group>
  );
}

type LoadedImageState = {
  src: string;
  image: HTMLImageElement | null;
  status: "idle" | "loading" | "loaded" | "error";
  retry: () => void;
};

function useLoadedImage(src: string | undefined): LoadedImageState {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<LoadedImageState>({
    src: "",
    image: null,
    status: "idle",
    retry: () => setRetryCount((count) => count + 1),
  });
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);
  useEffect(() => {
    if (!src) return;
    // Defense-in-depth: do not load a disallowed src (blocks SSRF/beacon via a
    // persisted URL). Mirror the allowlist enforced by the save schema.
    if (!isAllowedImageSrc(src)) return;
    let active = true;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (active) setState({ src, image, status: "loaded", retry });
    };
    image.onerror = () => {
      if (active) setState({ src, image: null, status: "error", retry });
    };
    image.src = src;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [src, retryCount, retry]);
  if (!src) return { src: "", image: null, status: "idle", retry };
  if (!isAllowedImageSrc(src))
    return { src, image: null, status: "error", retry };
  return state.src === src
    ? state
    : { src, image: null, status: "loading", retry };
}

function ImageElement({
  element,
  ...rest
}: { element: TemplateElement } & Record<string, unknown>) {
  const imageState = useLoadedImage(element.src);
  const shapeProps = rest as unknown as Konva.RectConfig & Konva.ImageConfig;
  if (!element.src)
    return (
      <Rect
        {...shapeProps}
        width={element.width}
        height={element.height}
        fill="#eeeeee"
        stroke="#bbbbbb"
        strokeWidth={1}
        dash={[6, 4]}
      />
    );
  if (imageState.status === "loading" || imageState.status === "error") {
    const x = typeof shapeProps.x === "number" ? shapeProps.x : element.x;
    const y = typeof shapeProps.y === "number" ? shapeProps.y : element.y;
    const failed = imageState.status === "error";
    return (
      <>
        <Rect
          {...shapeProps}
          width={element.width}
          height={element.height}
          fill={failed ? "#fef2f2" : "#f3f4f6"}
          stroke={failed ? "#fca5a5" : "#d1d5db"}
          strokeWidth={1}
        />
        <Text
          x={x + 8}
          y={y + 8}
          width={Math.max(0, element.width - 16)}
          height={Math.max(0, element.height - 16)}
          text={
            failed
              ? `${t("image.failed")} · ${t("image.retry")}`
              : t("image.loading")
          }
          fontSize={13}
          fill={failed ? "#b91c1c" : "#525252"}
          align="center"
          verticalAlign="middle"
          wrap="word"
          listening={false}
        />
        {failed && (
          <Rect
            x={x}
            y={y}
            width={element.width}
            height={element.height}
            fill="rgba(0,0,0,0)"
            onMouseEnter={(event) => {
              const container = event.target.getStage()?.container();
              if (container) container.style.cursor = "pointer";
            }}
            onMouseLeave={(event) => {
              const container = event.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              imageState.retry();
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              imageState.retry();
            }}
          />
        )}
      </>
    );
  }
  const image = imageState.image;
  const imageWidth = image?.naturalWidth ?? element.width;
  const imageHeight = image?.naturalHeight ?? element.height;
  const scale = Math.min(
    element.width / imageWidth,
    element.height / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const x =
    (typeof shapeProps.x === "number" ? shapeProps.x : element.x) +
    (element.width - width) / 2;
  const y =
    (typeof shapeProps.y === "number" ? shapeProps.y : element.y) +
    (element.height - height) / 2;
  return (
    <KonvaImage
      {...shapeProps}
      image={image ?? undefined}
      x={x}
      y={y}
      width={width}
      height={height}
    />
  );
}
