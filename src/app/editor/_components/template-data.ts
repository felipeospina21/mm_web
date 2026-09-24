import type { PageData, QuotationData, TemplateElement } from './types'
import { PAGE_WIDTH } from './types'

/**
 * Shared header band + title used on the first page only.
 * Contains my-company info (left) and client info (right).
 */
function makeFirstPageHeader(): TemplateElement[] {
  return [
    {
      id: 'header-band',
      type: 'rect',
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 150,
      text: '',
      fontSize: 0,
      fill: '#1f4e79',
      isDraggable: true,
    },
    {
      id: 'doc-title',
      type: 'text',
      x: 40,
      y: 20,
      width: 300,
      height: 40,
      text: 'QUOTATION',
      fontSize: 28,
      fill: '#ffffff',
      isDraggable: true,
    },
    {
      id: 'company-info',
      type: 'text',
      x: 40,
      y: 60,
      width: 350,
      height: 60,
      text: '{{companyName}}\n{{companyAddress}}\n{{companyPhone}}',
      fontSize: 11,
      fill: '#cfe2f3',
      isDraggable: true,
    },
    {
      id: 'client-info',
      type: 'text',
      x: 460,
      y: 20,
      width: 300,
      height: 110,
      text:
        'Prepared for:\n{{customerName}}\n{{customerAddress}}\n{{customerEmail}}',
      fontSize: 12,
      fill: '#ffffff',
      isDraggable: true,
    },
  ]
}

/** Product block: name, price, description (used on pages 1..n-1) */
function makeProductElements(suffix: string): TemplateElement[] {
  return [
    {
      id: `product-name-${suffix}`,
      type: 'text',
      x: 40,
      y: 220,
      width: 600,
      height: 40,
      text: 'Product: {{productName}}',
      fontSize: 24,
      fill: '#1f4e79',
      isDraggable: true,
    },
    {
      id: `product-price-${suffix}`,
      type: 'text',
      x: 40,
      y: 280,
      width: 300,
      height: 36,
      text: 'Price: {{productPrice}}',
      fontSize: 20,
      fill: '#2e7d32',
      isDraggable: true,
    },
    {
      id: `product-description-${suffix}`,
      type: 'text',
      x: 40,
      y: 340,
      width: 700,
      height: 120,
      text: 'Description: {{productDescription}}',
      fontSize: 16,
      fill: '#555555',
      isDraggable: true,
    },
    {
      id: `line-items-${suffix}`,
      type: 'table',
      x: 40,
      y: 500,
      width: 714,
      height: 150,
      text: '',
      fontSize: 0,
      fill: '#000000',
      isDraggable: true,
      table: {
        colWidths: [80, 300, 120, 120],
        rowHeight: 36,
        cells: [
          ['Qty', 'Item', 'Unit Price', 'Total'],
          ['1', '{{productName}}', '{{productPrice}}', '{{productPrice}}'],
          ['', '', '', ''],
          ['', '', '', ''],
        ],
        headerFill: '#1f4e79',
        headerColor: '#ffffff',
        borderColor: '#cccccc',
        fontSize: 13,
      },
    },
    {
      id: `accent-box-${suffix}`,
      type: 'rect',
      x: 40,
      y: 180,
      width: 8,
      height: 220,
      text: '',
      fontSize: 0,
      fill: '#f0a500',
      isDraggable: true,
    },
  ]
}

/** Footer used on every page */
function makeFooter(): TemplateElement[] {
  return [
    {
      id: 'footer',
      type: 'text',
      x: 40,
      y: 1060,
      width: 500,
      height: 24,
      text: 'Thank you for your business.',
      fontSize: 12,
      fill: '#999999',
      isDraggable: true,
    },
  ]
}

/**
 * First page: company + client header, then the FIRST product.
 */
function makeFirstPageElements(): TemplateElement[] {
  return [
    ...makeFirstPageHeader(),
    ...makeProductElements('p1'),
    {
      id: 'customer-name-line',
      type: 'text',
      x: 40,
      y: 120,
      width: 500,
      height: 30,
      text: 'Customer: {{customerName}}',
      fontSize: 18,
      fill: '#333333',
      isDraggable: true,
    },
    ...makeFooter(),
  ]
}

/**
 * Middle pages (products 2..n-1): no company/client header,
 * just the product block.
 */
function makeProductPageElements(suffix: string): TemplateElement[] {
  return [
    {
      id: 'page-band',
      type: 'rect',
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 50,
      text: '',
      fontSize: 0,
      fill: '#1f4e79',
      isDraggable: true,
    },
    {
      id: 'page-title',
      type: 'text',
      x: 40,
      y: 12,
      width: 400,
      height: 30,
      text: 'QUOTATION (cont.)',
      fontSize: 18,
      fill: '#ffffff',
      isDraggable: true,
    },
    ...makeProductElements(suffix),
    ...makeFooter(),
  ]
}

/**
 * Last page: fixed commercial policies, no product info.
 */
function makePoliciesPageElements(): TemplateElement[] {
  return [
    {
      id: 'policies-band',
      type: 'rect',
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: 50,
      text: '',
      fontSize: 0,
      fill: '#1f4e79',
      isDraggable: true,
    },
    {
      id: 'policies-title',
      type: 'text',
      x: 40,
      y: 12,
      width: 400,
      height: 30,
      text: 'COMMERCIAL POLICIES',
      fontSize: 18,
      fill: '#ffffff',
      isDraggable: true,
    },
    {
      id: 'policies-body',
      type: 'text',
      x: 40,
      y: 100,
      width: 700,
      height: 500,
      text: `1. Prices are quoted in USD and are valid for 30 days from the quotation date.
2. Payment terms: 50% upfront, 50% upon delivery.
3. Delivery timeline: 8–12 weeks from project kickoff.
4. Prices do not include taxes; applicable taxes will be added to the final invoice.
5. Any scope change must be agreed in writing and may affect price and timeline.
6. This quotation does not constitute a contract until signed by both parties.`,
      fontSize: 14,
      fill: '#444444',
      isDraggable: true,
    },
    {
      id: 'signature-line',
      type: 'text',
      x: 40,
      y: 900,
      width: 300,
      height: 24,
      text: 'Accepted by: ______________________',
      fontSize: 14,
      fill: '#333333',
      isDraggable: true,
    },
    ...makeFooter(),
  ]
}

/** Replaces all placeholders in a text string with quotation values */
function interpolate(
  text: string,
  quotation: QuotationData,
  product: QuotationData['products'][number],
): string {
  return text
    .replace('{{companyName}}', quotation.companyName)
    .replace('{{companyAddress}}', quotation.companyAddress)
    .replace('{{companyPhone}}', quotation.companyPhone)
    .replace('{{customerName}}', quotation.customerName)
    .replace('{{customerEmail}}', quotation.customerEmail)
    .replace('{{productName}}', product.name)
    .replace('{{productPrice}}', product.price)
    .replace('{{productDescription}}', product.description)
}

/**
 * Builds the full page set from a quotation:
 *  - Page 1: header (company + client) + first product
 *  - Pages 2..n-1: one product per page
 *  - Last page: commercial policies
 */
export function buildPagesFromQuotation(
  quotation: QuotationData,
): PageData[] {
  const pages: PageData[] = []

  quotation.products.forEach((product, index) => {
    const pageNumber = pages.length + 1

    const baseElements =
      index === 0 ? makeFirstPageElements() : makeProductPageElements(`p${pageNumber}`)

    const pageElements = baseElements.map((el) => {
      const next: TemplateElement = {
        ...el,
        text: interpolate(el.text, quotation, product),
      }
      // Placeholders inside table cells too
      if (next.table) {
        next.table = {
          ...next.table,
          cells: next.table.cells.map((row) =>
            row.map((cell) => interpolate(cell, quotation, product)),
          ),
        }
      }
      return next
    })

    pages.push({
      id: `page-${pageNumber}`,
      pageNumber,
      elements: pageElements,
    })
  })

  // Final policies page
  const policiesPageNumber = quotation.products.length + 1
  pages.push({
    id: `page-${policiesPageNumber}`,
    pageNumber: policiesPageNumber,
    elements: makePoliciesPageElements(),
  })

  return pages
}

/** Master template shown before "Populate Data" is clicked */
export function makeMasterTemplate(): PageData {
  return {
    id: 'page-template',
    pageNumber: 1,
    elements: makeFirstPageElements(),
  }
}

export const DUMMY_QUOTATION: QuotationData = {
  companyName: 'My Company Inc.',
  companyAddress: '123 Business Ave, Suite 400',
  companyPhone: '+1 (555) 123-4567',
  customerName: 'Acme Corporation',
  customerAddress: '789 Client Blvd, Suite 200',
  customerEmail: 'contact@acme.com',
  products: [
    {
      name: 'Enterprise Web Platform',
      price: '$12,500.00',
      description:
        'A full-featured web platform including CMS, user management, and analytics dashboard. Includes 12 months of support and hosting.',
    },
    {
      name: 'Mobile App Development',
      price: '$8,900.00',
      description:
        'Native iOS and Android application with offline sync, push notifications, and app store deployment assistance.',
    },
    {
      name: 'UI/UX Design Sprint',
      price: '$4,200.00',
      description:
        'A two-week design sprint covering user research, wireframes, high-fidelity mockups, and an interactive prototype.',
    },
  ],
}
