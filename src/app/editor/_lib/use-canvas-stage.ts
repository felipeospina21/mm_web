import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";
import {
  PAGE_GAP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  type PageData,
} from "../_components/types";
import { getPageOffset } from "./quotation-canvas-geometry";

export interface PastePosition {
  pageNumber: number;
  x: number;
  y: number;
}

interface UseCanvasStageOptions {
  pages: PageData[];
  onActivePageChange: (pageNumber: number) => void;
  onSelectionChange: (elementId: string | null) => void;
  scrollTopRef: { current: number };
}

export function useCanvasStage({
  pages,
  onActivePageChange,
  onSelectionChange,
  scrollTopRef,
}: UseCanvasStageOptions) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pastePositionRef = useRef<PastePosition>({
    pageNumber: 1,
    x: 100,
    y: 100,
  });

  useEffect(() => {
    onSelectionChange(selectedId);
  }, [selectedId, onSelectionChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setStageSize({ width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const updateActivePageFromPointer = useCallback(() => {
    const point = stageRef.current?.getPointerPosition();
    if (!point) return;
    const pageNumber =
      Math.floor(
        (point.y + scrollTopRef.current - 40) / (PAGE_HEIGHT + PAGE_GAP),
      ) + 1;
    const page = pages.find((item) => item.pageNumber === pageNumber);
    if (!page || point.x < 40 || point.x > 40 + PAGE_WIDTH) return;
    const offset = getPageOffset(pageNumber);
    pastePositionRef.current = {
      pageNumber,
      x: Math.max(0, Math.min(PAGE_WIDTH - 300, point.x - offset.x)),
      y: Math.max(
        0,
        Math.min(PAGE_HEIGHT - 200, point.y + scrollTopRef.current - offset.y),
      ),
    };
    onActivePageChange(pageNumber);
  }, [onActivePageChange, pages, scrollTopRef]);

  const updatePastePositionFromPointer = useCallback(
    (pageNumber: number) => {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const offset = getPageOffset(pageNumber);
      pastePositionRef.current = {
        pageNumber,
        x: Math.max(0, pointer.x - offset.x),
        y: Math.max(0, pointer.y + scrollTopRef.current - offset.y),
      };
    },
    [scrollTopRef],
  );

  const selectElement = useCallback(
    (elementId: string, pageNumber: number) => {
      setSelectedId(elementId);
      onActivePageChange(pageNumber);
      updatePastePositionFromPointer(pageNumber);
    },
    [onActivePageChange, updatePastePositionFromPointer],
  );

  const deselect = useCallback(() => setSelectedId(null), []);

  const handleStageMouseDown = useCallback(
    (
      event: Konva.KonvaEventObject<MouseEvent>,
      clearTableSelection: () => void,
    ) => {
      containerRef.current?.focus({ preventScroll: true });
      if (event.target === event.target.getStage()) {
        deselect();
        clearTableSelection();
      }
      updateActivePageFromPointer();
    },
    [deselect, updateActivePageFromPointer],
  );

  const handleStageTouchStart = useCallback(
    (
      event: Konva.KonvaEventObject<TouchEvent>,
      clearTableSelection: () => void,
    ) => {
      containerRef.current?.focus({ preventScroll: true });
      if (event.target === event.target.getStage()) {
        deselect();
        clearTableSelection();
      }
      updateActivePageFromPointer();
    },
    [deselect, updateActivePageFromPointer],
  );

  return {
    stageRef,
    containerRef,
    stageSize,
    selectedId,
    setSelectedId,
    pastePositionRef,
    updateActivePageFromPointer,
    updatePastePositionFromPointer,
    selectElement,
    handleStageMouseDown,
    handleStageTouchStart,
  };
}
