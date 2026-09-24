import type Konva from 'konva'
import { jsPDF } from 'jspdf'
import type { PageData } from './types'
import { PAGE_HEIGHT, PAGE_WIDTH } from './types'
import { getPageOffset } from './quotation-canvas'

/**
 * Captures a single page as a high-resolution base64 PNG by clipping
 * the Konva stage to exactly that page's white rectangle.
 */
function capturePage(stage: Konva.Stage, page: PageData): string {
  const offset = getPageOffset(page.pageNumber)
  return stage.toDataURL({
    x: offset.x,
    y: offset.y,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    // 2x for crisper text in the exported PDF
    pixelRatio: 2,
    mimeType: 'image/png',
  })
}

/**
 * Exports every page in `pages` to a multi-page PDF.
 * The first page reuses the jsPDF instance's implicit first page;
 * subsequent pages call pdf.addPage().
 */
export function exportPagesToPdf(
  stage: Konva.Stage,
  pages: PageData[],
  filename = 'quotation.pdf',
): void {
  if (pages.length === 0) {
    throw new Error('No pages to export')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
  })

  pages.forEach((page, index) => {
    if (index > 0) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait')
    }
    const dataUrl = capturePage(stage, page)
    pdf.addImage(
      dataUrl,
      'PNG',
      0,
      0,
      PAGE_WIDTH,
      PAGE_HEIGHT,
      undefined,
      'FAST',
    )
  })

  pdf.save(filename)
}
