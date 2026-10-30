import type { ElementRole, TemplateElement } from "../_components/types";

/**
 * Legacy element ids that carry a trailing per-page suffix (e.g.
 * `product-name-p1`, `line-items-p2`). Matched by prefix.
 */
const LEGACY_PREFIX_ROLES: ReadonlyArray<readonly [string, ElementRole]> = [
  ["product-name-", "product-name"],
  ["product-reference-", "product-reference"],
  ["product-description-", "product-description"],
  ["product-image-", "product-image"],
  ["line-items-", "line-items"],
];

/** Legacy element ids that are a single fixed string (one per document). */
const LEGACY_EXACT_ROLES: Readonly<Record<string, ElementRole>> = {
  "quotation-number": "quotation-number",
  "representative-info": "representative-info",
  footer: "footer",
  "policies-body": "policies-body",
  "customer-name": "customer-name",
  "company-name": "company-name",
};

/** Map a legacy element id to its role, or `undefined` if unrecognized. */
function legacyRoleFromId(id: string): ElementRole | undefined {
  const exact = LEGACY_EXACT_ROLES[id];
  if (exact) return exact;
  for (const [prefix, role] of LEGACY_PREFIX_ROLES) {
    if (id.startsWith(prefix)) return role;
  }
  return undefined;
}

/**
 * Resolve an element's semantic {@link ElementRole}.
 *
 * Prefers the explicit `role` field; falls back to a mapping from legacy
 * element ids so documents saved before `role` existed still resolve. Returns
 * `undefined` for free-form / unrecognized elements (never throws).
 */
export function elementRole(element: TemplateElement): ElementRole | undefined {
  return element.role ?? legacyRoleFromId(element.id);
}

/** True when the element is the line-items table (legacy id or explicit role). */
export function isLineItems(element: TemplateElement): boolean {
  return elementRole(element) === "line-items";
}

/**
 * True when a bare element id resolves to the line-items role. For call sites
 * that only have an id string (not the element), e.g. the id of the element
 * currently being inline-edited. Legacy-id based by nature.
 */
export function isLineItemsId(id: string | null | undefined): boolean {
  return id != null && legacyRoleFromId(id) === "line-items";
}
