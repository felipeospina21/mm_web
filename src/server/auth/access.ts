import { type Session } from "next-auth";

/**
 * Authorization seam for quotation visibility.
 *
 * Roles are not implemented yet. The intended model is:
 *   - admin (managers): can see/retrieve ANY quotation
 *   - user  (sales reps): can see/retrieve ONLY their own quotations
 *
 * For now this returns `true` so any authenticated user can access any
 * quotation (per current product decision). When roles land, change this to:
 *
 *   return session.user.role === "admin";
 *
 * Keeping the check behind this single helper means the list/byId queries
 * don't need to change — only this function does.
 */
export function canAccessAllQuotations(_session: Session): boolean {
  return true;
}
