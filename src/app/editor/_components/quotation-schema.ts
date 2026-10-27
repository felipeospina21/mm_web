import { z } from "zod";

import type { PageData, TableData, TemplateElement } from "./types";

/**
 * Validation schema for the persisted quotation `data` (the JSONB snapshot).
 *
 * Design (see docs/editor-improvements-plan.md, Task 2.1):
 *   - **Template-agnostic.** Validates only the structural grammar of a page /
 *     element / table — never a specific template or required element IDs — so
 *     the editor can stay open to custom and future templates.
 *   - **Lossless.** Every object uses `.passthrough()`, so unknown / future keys
 *     survive `parse()` untouched. The coming quotation module reloads saved
 *     quotations into the editor, so the stored document is a faithful snapshot
 *     and must round-trip exactly. We never `.strip()`.
 *   - **Bounds are generous.** Max lengths exist to reject absurd abuse, not to
 *     constrain real content.
 *
 * `types.ts` remains the authoritative hand-written model the editor programs
 * against; this schema is the runtime validator at the `save` trust boundary.
 * A compile-time drift guard at the bottom of this file keeps the two in sync.
 */

/** Element `type` discriminator — the one closed enum in the document. */
const elementTypeSchema = z.enum(["text", "rect", "image", "table"]);

export const tableDataSchema = z
  .object({
    colWidths: z.array(z.number()).max(100),
    rowHeight: z.number().nonnegative(),
    cells: z.array(z.array(z.string().max(10_000))).max(1_000),
    headerFill: z.string().max(64),
    headerColor: z.string().max(64),
    borderColor: z.string().max(64),
    fontSize: z.number().nonnegative(),
  })
  .passthrough();

export const templateElementSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: elementTypeSchema,
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    text: z.string().max(20_000),
    fontSize: z.number().nonnegative(),
    lineHeight: z.number().positive().optional(),
    fill: z.string().max(64),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    fontFamily: z.string().max(200).optional(),
    isDraggable: z.boolean(),
    isEditable: z.boolean().optional(),
    isDeletable: z.boolean().optional(),
    isRowDeletable: z.boolean().optional(),
    table: tableDataSchema.optional(),
    // `src` is left permissive here; Task 2.2 constrains it to data:/allowlisted
    // URLs in this same schema.
    src: z.string().max(5_000_000).optional(),
  })
  .passthrough();

export const pageDataSchema = z
  .object({
    id: z.string().min(1).max(200),
    pageNumber: z.number().int().positive(),
    elements: z.array(templateElementSchema).max(1_000),
  })
  .passthrough();

/** The persisted quotation document: an array of canvas pages. */
export const quotationDocumentSchema = z.array(pageDataSchema).max(500);

/**
 * Router-facing variant used as tRPC input.
 *
 * `quotationDocumentSchema` validates losslessly (passthrough), but passthrough's
 * *input* type carries a `[k: string]: unknown` index signature that the precise
 * hand-written `PageData` lacks — which would force every `save` caller to widen
 * their well-typed `PageData[]`. We keep the exact same runtime validation but
 * re-type the input/output as the authoritative `PageData[]`, so callers pass
 * (and receive) the precise editor type. Unknown keys are still preserved at
 * runtime; they are simply not surfaced in the static type.
 */
export const quotationDocumentInput = z
  .custom<PageData[]>()
  .pipe(quotationDocumentSchema)
  .transform((pages) => pages as unknown as PageData[]);

/* ------------------------------------------------------------------ *
 * Compile-time drift guard.
 *
 * We deliberately do NOT `z.infer` the app types from these schemas: the
 * `.passthrough()` needed for losslessness would add a `[k: string]: unknown`
 * index signature and loosen the precise hand-written types across the editor.
 * Instead we assert — at zero runtime cost — that the schema's MODELED fields
 * stay structurally compatible with the hand-written interfaces in `types.ts`.
 * If a field is added/changed in `types.ts` without updating the schema (or
 * vice-versa), `pnpm typecheck` fails here.
 * ------------------------------------------------------------------ */

/** Drop the passthrough index signature, leaving only the explicitly modeled keys. */
type KnownKeys<T> = {
  [K in keyof T as string extends K ? never : K]: T[K];
};

type AssertAssignable<Expected, Actual extends Expected> = Actual;

// Each line errors if the schema's known shape drifts from the interface.
type _TableOk = AssertAssignable<
  TableData,
  KnownKeys<z.infer<typeof tableDataSchema>>
>;
type _ElementOk = AssertAssignable<
  TemplateElement,
  KnownKeys<z.infer<typeof templateElementSchema>>
>;
type _PageOk = AssertAssignable<
  PageData,
  KnownKeys<z.infer<typeof pageDataSchema>>
>;

// Reference the aliases so "unused type" lint does not drop the guard.
export type _SchemaDriftGuards = [_TableOk, _ElementOk, _PageOk];
