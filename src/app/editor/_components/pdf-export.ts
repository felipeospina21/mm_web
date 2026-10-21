import { jsPDF } from "jspdf";
import type { PageData, TableData, TemplateElement } from "./types";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./types";

const PX_TO_PT = 0.75;

function parseColor(color: string): [number, number, number] {
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((digit) => `${digit}${digit}`)
            .join("")
        : hex;
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return [0, 0, 0];
}

function getFontFamily(fontFamily: string | undefined): "helvetica" | "times" | "courier" {
  const family = fontFamily?.toLowerCase() ?? "arial";
  if (family.includes("times") || family.includes("georgia")) return "times";
  if (family.includes("courier")) return "courier";
  return "helvetica";
}

function getFontStyle(element: TemplateElement): "normal" | "bold" | "italic" | "bolditalic" {
  if (element.fontWeight === "bold" && element.italic) return "bolditalic";
  if (element.fontWeight === "bold") return "bold";
  if (element.italic) return "italic";
  return "normal";
}

function wrapText(pdf: jsPDF, text: string, width: number): string[] {
  return text.split("\n").flatMap((line) =>
    line.length === 0 ? [""] : pdf.splitTextToSize(line, Math.max(width, 1)),
  );
}

function drawTextElement(pdf: jsPDF, element: TemplateElement): void {
  if (!element.text) return;

  const fontSizePx = element.fontSize;
  const lineHeightPx = fontSizePx * (element.lineHeight ?? 1.2);
  const [red, green, blue] = parseColor(element.fill);

  pdf.setFont(getFontFamily(element.fontFamily), getFontStyle(element));
  pdf.setFontSize(fontSizePx * PX_TO_PT);
  pdf.setTextColor(red, green, blue);
  const maxLines = Math.max(1, Math.floor(element.height / lineHeightPx));
  const lines = wrapText(pdf, element.text, element.width).slice(0, maxLines);

  lines.forEach((line, index) => {
    const x = element.x;
    const baseline = element.y + fontSizePx * 0.85 + index * lineHeightPx;
    pdf.text(line, x, baseline);
    if (element.underline && line) {
      const width = Math.min(pdf.getTextWidth(line), element.width);
      const underlineY = baseline + fontSizePx * 0.08;
      pdf.setDrawColor(red, green, blue);
      pdf.setLineWidth(0.5);
      pdf.line(x, underlineY, x + width, underlineY);
    }
  });
}

function drawRectElement(pdf: jsPDF, element: TemplateElement): void {
  const [red, green, blue] = parseColor(element.fill);
  pdf.setFillColor(red, green, blue);
  pdf.rect(element.x, element.y, element.width, element.height, "F");
}

function drawTable(pdf: jsPDF, element: TemplateElement, table: TableData): void {
  const [borderRed, borderGreen, borderBlue] = parseColor(table.borderColor);
  const [headerRed, headerGreen, headerBlue] = parseColor(table.headerFill);
  const [headerTextRed, headerTextGreen, headerTextBlue] = parseColor(
    table.headerColor,
  );
  const rowText = parseColor("#333333");
  const tableWidth = table.colWidths.reduce((sum, width) => sum + width, 0);

  pdf.setLineWidth(0.6);
  table.cells.forEach((row, rowIndex) => {
    let x = element.x;
    const y = element.y + rowIndex * table.rowHeight;
    row.forEach((cell, colIndex) => {
      const width = table.colWidths[colIndex] ?? 0;
      if (rowIndex === 0) {
        pdf.setFillColor(headerRed, headerGreen, headerBlue);
      } else {
        pdf.setFillColor(255, 255, 255);
      }
      pdf.setDrawColor(borderRed, borderGreen, borderBlue);
      pdf.rect(x, y, width, table.rowHeight, "FD");

      const fontSizePx = table.fontSize;
      pdf.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
      pdf.setFontSize(fontSizePx * PX_TO_PT);
      if (rowIndex === 0) {
        pdf.setTextColor(headerTextRed, headerTextGreen, headerTextBlue);
      } else {
        pdf.setTextColor(rowText[0], rowText[1], rowText[2]);
      }
      const lines = wrapText(pdf, cell, Math.max(width - 16, 1));
      const lineHeightPx = fontSizePx * 1.2;
      const visibleLines = lines.slice(
        0,
        Math.max(1, Math.floor(table.rowHeight / lineHeightPx)),
      );
      visibleLines.forEach((line, lineIndex) => {
        const blockHeight = visibleLines.length * lineHeightPx;
        const firstBaseline =
          y + (table.rowHeight - blockHeight) / 2 + fontSizePx * 0.85;
        pdf.text(line, x + 8, firstBaseline + lineIndex * lineHeightPx);
      });
      x += width;
    });
    if (row.length < table.colWidths.length) {
      const missingWidth = table.colWidths
        .slice(row.length)
        .reduce((sum, width) => sum + width, 0);
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(borderRed, borderGreen, borderBlue);
      pdf.rect(x, y, missingWidth, table.rowHeight, "FD");
    }
  });

  // Preserve the table's outer boundary even when rows contain fewer cells.
  pdf.setDrawColor(borderRed, borderGreen, borderBlue);
  pdf.rect(
    element.x,
    element.y,
    tableWidth,
    table.rowHeight * table.cells.length,
    "S",
  );
}

async function loadImageData(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;

  const response = await fetch(new URL(src, window.location.href));
  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Image could not be read"));
    reader.onerror = () => reject(reader.error ?? new Error("Image could not be read"));
    reader.readAsDataURL(blob);
  });
}

function getImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function resizeImageData(
  dataUrl: string,
  displayWidth: number,
  displayHeight: number,
): Promise<string> {
  const image = new window.Image();
  const imageLoaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image could not be decoded"));
  });
  image.src = dataUrl;
  await imageLoaded;

  // Keep at most 2x the PDF's rendered dimensions and avoid enlarging small sources.
  const width = Math.max(1, Math.min(image.naturalWidth, Math.ceil(displayWidth * 2)));
  const height = Math.max(1, Math.min(image.naturalHeight, Math.ceil(displayHeight * 2)));
  if (width === image.naturalWidth && height === image.naturalHeight) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image resize canvas is unavailable");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const format = getImageFormat(dataUrl);
  const mimeType =
    format === "PNG"
      ? "image/png"
      : format === "WEBP"
        ? "image/webp"
        : "image/jpeg";
  return canvas.toDataURL(mimeType, 0.92);
}

async function drawImage(pdf: jsPDF, element: TemplateElement): Promise<void> {
  if (!element.src) {
    pdf.setFillColor(238, 238, 238);
    pdf.setDrawColor(187, 187, 187);
    pdf.rect(element.x, element.y, element.width, element.height, "FD");
    return;
  }

  try {
    const sourceData = await loadImageData(element.src);
    const dataUrl = await resizeImageData(
      sourceData,
      element.width,
      element.height,
    );
    pdf.addImage(
      dataUrl,
      getImageFormat(dataUrl),
      element.x,
      element.y,
      element.width,
      element.height,
      undefined,
      "FAST",
    );
  } catch (error) {
    console.warn("PDF image could not be loaded; drawing a placeholder.", error);
    pdf.setFillColor(243, 244, 246);
    pdf.setDrawColor(209, 213, 219);
    pdf.rect(element.x, element.y, element.width, element.height, "FD");
  }
}

async function drawElement(pdf: jsPDF, element: TemplateElement): Promise<void> {
  if (element.type === "text") {
    drawTextElement(pdf, element);
  } else if (element.type === "rect") {
    drawRectElement(pdf, element);
  } else if (element.type === "table" && element.table) {
    drawTable(pdf, element, element.table);
  } else if (element.type === "image") {
    await drawImage(pdf, element);
  }
}

/** Exports text and shapes as vectors, embedding raster data only for images. */
export async function exportPagesToPdf(
  pages: PageData[],
  filename = "quotation.pdf",
): Promise<void> {
  if (pages.length === 0) {
    throw new Error("No pages to export");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
  });

  for (const [index, page] of pages.entries()) {
    if (index > 0) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "portrait");
    }
    for (const element of page.elements) {
      await drawElement(pdf, element);
    }
  }

  pdf.save(filename);
}
