"use client";

import type { KeyboardEvent, MouseEvent, WheelEvent } from "react";

export interface EditingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
}

interface InlineTextEditorProps {
  id: string;
  isCell: boolean;
  box: EditingBox;
  value: string;
  inputMode?: "numeric";
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function InlineTextEditor({
  id,
  isCell,
  box,
  value,
  inputMode,
  onChange,
  onBlur,
  onKeyDown,
}: InlineTextEditorProps) {
  return (
    <textarea
      key={id || "text-editor"}
      data-cell-editor={isCell ? id : undefined}
      autoFocus
      className="border-primary fixed z-[100] m-0 resize-none border-2 border-dashed bg-white/95 p-0 outline-none"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        fontSize: box.fontSize,
        color: box.color,
      }}
      value={value}
      inputMode={inputMode}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={(event) => onBlur(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onMouseDown={(event: MouseEvent<HTMLTextAreaElement>) =>
        event.stopPropagation()
      }
      onWheel={(event: WheelEvent<HTMLTextAreaElement>) =>
        event.stopPropagation()
      }
    />
  );
}
