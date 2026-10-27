"use client";

import { t } from "@/i18n/messages";
import type { TemplateElement } from "./types";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "system-ui",
];

interface TextFormatControlsProps {
  element: TemplateElement;
  patch: (patch: Partial<TemplateElement>) => void;
}

/** Font family / size / bold / italic / underline / color controls. */
export function TextFormatControls({ element, patch }: TextFormatControlsProps) {
  return (
    <>
      <label className="flex items-center gap-1 text-xs text-neutral-700">
        {t("toolbar.font")}
        <select
          value={element.fontFamily ?? "Arial"}
          onChange={(e) => patch({ fontFamily: e.target.value })}
          className="ml-1 rounded border border-neutral-300 px-1 py-0.5"
        >
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs text-neutral-700">
        {t("toolbar.size")}
        <select
          value={element.fontSize}
          onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          className="ml-1 rounded border border-neutral-300 px-1 py-0.5"
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <button
        className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
          element.fontWeight === "bold" ? "font-extrabold" : "font-normal"
        }`}
        title={t("toolbar.bold")}
        onClick={() =>
          patch({
            fontWeight: element.fontWeight === "bold" ? "normal" : "bold",
          })
        }
      >
        B
      </button>
      <button
        className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
          element.italic ? "italic" : ""
        }`}
        title={t("toolbar.italic")}
        onClick={() => patch({ italic: !element.italic })}
      >
        I
      </button>
      <button
        className={`h-7 w-7 rounded border border-neutral-300 bg-neutral-100 text-[13px] ${
          element.underline ? "underline" : ""
        }`}
        title={t("toolbar.underline")}
        onClick={() => patch({ underline: !element.underline })}
      >
        U
      </button>
      <label className="flex items-center gap-1 text-xs text-neutral-700">
        {t("toolbar.color")}
        <input
          type="color"
          value={element.fill}
          onChange={(e) => patch({ fill: e.target.value })}
          className="h-6 w-8 cursor-pointer border-none bg-transparent"
        />
      </label>
    </>
  );
}
