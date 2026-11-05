/**
 * Turn a `quotation.save` failure into a human-readable, shareable Spanish
 * message for the toast. The raw tRPC/Zod error is JSON that users can neither
 * read nor describe in a support capture; this maps the first meaningful issue
 * to a sentence plus a short, quotable code (e.g. `QUOT-ID-TOO-LONG`).
 *
 * Pure and framework-free (no tRPC types) so it unit-tests easily. It reads the
 * loosely-typed error defensively:
 *   - tRPC validation failures carry `error.data.zodIssues` (our trimmed
 *     projection from the server `errorFormatter`: `{ path, code, maximum }[]`),
 *     whose `path` preserves the NESTED location `.flatten()` would have lost.
 *   - The 4.5 MB Vercel body limit (a 413) is rejected by the platform BEFORE
 *     tRPC runs, so it surfaces as a non-JSON response the client fails to parse
 *     (classic `Unexpected token 'R'`). We detect it by signature.
 *
 * See docs/quotation-size-limits.md for the limits these messages describe.
 */

/** A single trimmed Zod issue as projected by the server errorFormatter. */
export interface SaveErrorIssue {
  path: Array<string | number>;
  code: string;
  maximum?: number;
}

/** The minimal, defensively-read shape of the error passed to `onError`. */
export interface SaveErrorLike {
  message?: string;
  data?: {
    zodIssues?: SaveErrorIssue[] | null;
  } | null;
}

export interface FormattedSaveError {
  /** User-facing Spanish sentence for the toast. */
  message: string;
  /** Short, stable, quotable code shown in the message and loggable. */
  code: string;
}

/** Generic fallback when we can't classify the failure. */
const GENERIC: FormattedSaveError = {
  message:
    "No se pudo guardar la cotización. Inténtalo de nuevo; si el problema " +
    "persiste, comparte el código con soporte.",
  code: "QUOT-SAVE-FAILED",
};

/**
 * The 4.5 MB request-body limit. Clean, customer-facing wording; the infra
 * detail (Vercel) rides in the CODE for support/debugging, not the sentence.
 */
const TOO_LARGE: FormattedSaveError = {
  message:
    "La cotización es demasiado grande para guardarla. Reduce el número o " +
    "tamaño de las imágenes e inténtalo de nuevo. Código: QUOT-TOO-LARGE-VERCEL",
  code: "QUOT-TOO-LARGE-VERCEL",
};

/** Per-leaf-field bespoke copy for the caps a user can realistically hit. */
interface FieldRule {
  /** Spanish sentence; `{max}` is filled from the issue's `maximum`. */
  template: string;
  code: string;
}

const FIELD_RULES: Record<string, FieldRule> = {
  id: {
    template:
      "Un elemento tiene un identificador demasiado largo (máx. {max} " +
      "caracteres). Suele ocurrir al copiar y pegar un elemento muchas veces.",
    code: "QUOT-ID-TOO-LONG",
  },
  text: {
    template:
      "Un elemento tiene demasiado texto (máx. {max} caracteres). Acorta el " +
      "contenido e inténtalo de nuevo.",
    code: "QUOT-TEXT-TOO-LONG",
  },
  // Table cell text: the issue path ends at a numeric cell index inside `cells`,
  // handled specially below; this entry covers the message/code.
  cells: {
    template:
      "Una celda de tabla tiene demasiado texto (máx. {max} caracteres). " +
      "Acorta el contenido de la celda e inténtalo de nuevo.",
    code: "QUOT-CELL-TOO-LONG",
  },
  elements: {
    template:
      "Una página tiene demasiados elementos (máx. {max}). Reparte el " +
      "contenido en más páginas e inténtalo de nuevo.",
    code: "QUOT-TOO-MANY-ELEMENTS",
  },
};

const PREFIX = "No se pudo guardar: ";

/** Detect the platform 413 (body too large) from the error message signature. */
function isBodyTooLarge(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("request entity too large") ||
    m.includes("413") ||
    m.includes("payload too large") ||
    m.includes("content too large") ||
    // The tRPC client fails to JSON.parse the plain-text 413 body ("Request…"),
    // throwing "Unexpected token 'R'" (and browser variants).
    /unexpected token .?r/i.test(message)
  );
}

/**
 * The last STRING segment of the issue path is the leaf field name (numeric
 * segments are array indices). For `["data",13,"elements",7,"id"]` -> "id";
 * for a table cell `[...,"table","cells",2,0]` the last string is "cells".
 */
function leafField(path: Array<string | number>): string | undefined {
  for (let i = path.length - 1; i >= 0; i--) {
    const seg = path[i];
    if (typeof seg === "string") return seg;
  }
  return undefined;
}

/**
 * Resolve the bespoke field rule from the issue's path SHAPE, not just its leaf
 * name — because some leaves are ambiguous:
 *   - `[...,"elements",7,"id"]`      -> element id too long
 *   - `[...,"elements",7,"text"]`    -> element text too long
 *   - `[...,"elements"]` (too_big)   -> too many elements on a page
 *   - `[...,"table","cells",2,0]`    -> cell TEXT too long (ends in two indices)
 *   - `[...,"table","cells"]`        -> too many ROWS (not handled bespoke;
 *                                       falls through to generic)
 */
function resolveRule(
  path: Array<string | number>,
): { rule: FieldRule } | null {
  const leaf = path[path.length - 1];

  // Cell text: path ends "...cells", <rowIndex>, <colIndex> (two numbers).
  const cellTextShape =
    path.length >= 3 &&
    path[path.length - 3] === "cells" &&
    typeof path[path.length - 2] === "number" &&
    typeof leaf === "number";
  if (cellTextShape) return { rule: FIELD_RULES.cells! };

  // Named leaf fields: id, text, elements (count), … but NOT "cells": a string
  // "cells" leaf is a ROW-COUNT cap, not cell text (that is the shape above).
  if (typeof leaf === "string" && leaf !== "cells") {
    const rule = FIELD_RULES[leaf];
    if (rule) return { rule };
  }
  return null;
}

/**
 * Map a save failure to `{ message, code }`. Never throws; always returns a
 * displayable result.
 */
export function formatSaveError(error: SaveErrorLike): FormattedSaveError {
  // 1. Platform 413 (body too large) — checked first; it never reaches tRPC.
  if (isBodyTooLarge(error.message)) return TOO_LARGE;

  // 2. Zod validation issue with a precise path.
  const issues = error.data?.zodIssues;
  const first = Array.isArray(issues) && issues.length > 0 ? issues[0] : null;
  if (first) {
    const resolved = resolveRule(first.path);
    if (resolved) {
      const { rule } = resolved;
      const max = first.maximum;
      const body = rule.template.replace(
        "{max}",
        max === undefined ? "el límite permitido" : String(max),
      );
      return {
        message: `${PREFIX}${body} Código: ${rule.code}`,
        code: rule.code,
      };
    }
    // Known validation shape but an unmapped field: still better than JSON.
    const field = leafField(first.path);
    return {
      message:
        `${PREFIX}un campo supera el límite permitido` +
        (field ? ` (campo: ${field})` : "") +
        `. Código: ${GENERIC.code}`,
      code: GENERIC.code,
    };
  }

  // 3. Unclassified failure.
  return GENERIC;
}
