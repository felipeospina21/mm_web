/**
 * Core data structures for the Quotation Editor.
 *
 * State is structured BY PAGE (not a flat element array) so that
 * each product gets its own page and PDF export can clip per page.
 */

export type ElementType = 'text' | 'rect' | 'image' | 'table'

/** A simple table: grid of cells with per-column widths */
export interface TableData {
  /** Width of each column in px; sum should equal element width */
  colWidths: number[]
  /** Uniform row height in px */
  rowHeight: number
  /** cells[row][col] — text content of each cell */
  cells: string[][]
  /** Header row styling */
  headerFill: string
  headerColor: string
  borderColor: string
  fontSize: number
}

export interface TemplateElement {
  id: string
  type: ElementType
  /** Position relative to the top-left corner of the parent page */
  x: number
  y: number
  width: number
  height: number
  /** Text content (only meaningful for type === 'text') */
  text: string
  fontSize: number
  fill: string
  /** Font weight for text elements ('normal' | 'bold') */
  fontWeight?: 'normal' | 'bold'
  /** Italic for text elements */
  italic?: boolean
  /** Underline for text elements */
  underline?: boolean
  /** Font family for text elements */
  fontFamily?: string
  isDraggable: boolean
  /** Table content (only meaningful for type === 'table') */
  table?: TableData
  /** Image source as data URL (only meaningful for type === 'image') */
  src?: string
}

export interface PageData {
  id: string
  pageNumber: number
  elements: TemplateElement[]
}

export interface Product {
  name: string
  price: string
  description: string
}

export interface QuotationData {
  companyName: string
  companyAddress: string
  companyPhone: string
  customerName: string
  customerAddress: string
  customerEmail: string
  products: Product[]
}

/** A4 at 96 DPI */
export const PAGE_WIDTH = 794
export const PAGE_HEIGHT = 1123
/** Vertical gap between stacked pages */
export const PAGE_GAP = 50
/** Dark stage background */
export const STAGE_BG = '#3a3a3a'
