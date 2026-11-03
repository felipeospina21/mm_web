# Phase 2 — Quotation Module — implementation plan

> Ordered, actionable task list for the quotation module (retrieve / draft /
> finalize / delete saved quotations, user roles, and free-form templates).
>
> **This plan is interlocked with [`editor-improvements-plan.md`](./editor-improvements-plan.md)**,
> not sequential to it. That plan deliberately parked two items *inside* this
> module (improvements **Task 2.3** required-elements enforcement, and the Phase 5
> `isDraft` band-aid note) and built the foundations this module depends on
> (lossless schema, element `role` discriminator, editor decomposition + tests,
> the `useQuotationLoad`/`useQuotationPersistence` hooks). Cross-references below
> point back to it as "(imp Task X)".
>
> Line numbers were taken from the working tree on 2026-11-03 and may drift —
> re-confirm before editing.

## Conventions for every task

- Work the plan **task-by-task**. For each task, briefly discuss problem / fix /
  architecture and **wait for explicit confirmation before coding** (per
  `AGENTS.md`). Keep explanations brief.
- Commit directly to `main`, **one self-contained commit per task**; keep
  unrelated concerns in separate commits.
- After each task: `rm -rf .next/types && pnpm typecheck`, then `pnpm lint`,
  then `pnpm test` must pass. Add/adjust tests where the task says so.
- Verification baselines (don't chase): `pnpm test` has ONE pre-existing,
  unrelated failure in `src/server/external/schema.test.ts`.
- Follow `AGENTS.md`: kebab-case component files, interfaces over type aliases,
  small components, custom hooks to consolidate related state. Custom hooks live
  in `src/app/editor/_hooks/` (`use-*`); pure decision/transform logic lives in
  `src/app/editor/_lib/` WITH unit tests.
- After each task, mark it done in the **Status** block below (the source of
  truth) and collapse the finished task to a one-line reference with its commit
  SHA.

---

## Open decisions (confirm before the dependent task starts)

Each task that depends on one of these is marked **DECISION PENDING**. Values
shown are the **recommended defaults**; change them here first if you disagree.

| # | Decision | Recommended default | Affects task |
|---|----------|---------------------|--------------|
| D1 | Draft = `status` column on `quotations`, or a separate table? | **`status` column** (reuses all save/list/byId plumbing) | T3 |
| D2 | `quotationNumber`: assign at draft creation (current) or defer to finalize? | **Defer to finalize** (no gaps from abandoned drafts; number nullable until final) | T3, T5 |
| D3 | Delete: soft or hard? Who can delete? | **Soft** (`deletedDate`); owner + admin | T4 |
| D4 | Can a `user` edit/delete *another* user's quotation? | **Admin only**; `user` edits/deletes only own | T1, T4 |
| D5 | Can a draft exist without a client? | **Yes** — client required only at finalize | T3, T5, T9 |
| D6 | Is autosave in-scope for v1? | **No** — explicit save for v1; autosave is optional T10 | T10 |
| D7 | Explicit `templateKind` column, or infer standard-vs-free? | **Explicit `templateKind`** (`'standard' \| 'free'`) | T3, T5, T6, T8 |
| D8 | How complete is client/contact CRUD today — verify & complete in-scope? | **Verify first**, then scope T9 from findings | T9 |
| D9 | Persisted image `src`: Supabase public bucket URL (allowlist its host) or keep **same-origin** via the `/api/image` proxy? | **Same-origin via proxy** (keeps `isAllowedImageSrc` unchanged, reuses CORS/canvas-taint handling) | T12 |
| D10 | Dedup key for "already stored": content **hash** or **source URL** (+ freshness window)? | **Content hash** as identity + source URL + freshness window to decide re-fetch | T12 |
| D11 | Image freshness window (re-fetch source after N) — configurable via env? | **Yes**, env var (e.g. `IMAGE_REFRESH_DAYS`, default 30) | T12 |
| D12 | Upload path: server-side (bytes through a route) or direct-to-storage (signed URL)? | **Server-side via the external proxy** for v1 (images are small, already fetched server-side); revisit signed upload only if user-uploaded images land | T12 |
| D13 | Orphan cleanup for images no longer referenced by any quotation? | **Deferred to a later maintenance task**; document, don't build in v1 | T12 |

---

## Status (updated 2026-11-03)

**Prerequisites already satisfied by `editor-improvements-plan.md`:**

- ✅ imp Task 2.1 — lossless, template-agnostic persisted schema
  (`quotation-schema.ts`, `quotationDocumentInput`). *Enables free templates.*
- ✅ imp Task 2.2 — image `src` allowlist (`isAllowedImageSrc`).
- ✅ imp Task 3.5 — element `role` discriminator (`_lib/element-role.ts`).
  *Enables `role`-based retrieval and free-template handling.*
- ✅ imp Task 3.3 — `useQuotationLoad` + `useQuotationPersistence` (built behind
  the flag; **this module makes them verifiable end-to-end**).
- ✅ imp Phase 3 — editor decomposition + ~46% test coverage (retires the
  God-component risk the free-template work rides on).

**Deferred items folded INTO this module:**

- ⏸️ imp Task 2.3 — required-elements enforcement → this plan's **Task 8b**.
- ⏸️ imp Phase 5 `isDraft` note — draft-protection band-aid → this plan's
  **Task 10b**.

**Related reference:** [`quotation-size-limits.md`](./quotation-size-limits.md)
already names base64 images in the save body as the **#1 save-breaker** (the
4.5 MB Vercel limit) and lists "store images in object storage, keep only the
URL" as **Mitigation #1** — exactly what **Task 12** builds.

**This module — not started:** T1–T12 (+ 8b, 10b) below.

**Suggested order:** T1 → T2 → T3 → T4 → T5 → T6 → T8 → T8b → T12 → (T7, T9, T10,
T10b as scope allows) → T11.
**Core MVP:** T1, T2, T3, T4, T5, T6, T8, T8b, **T12** (≈ 3.5–4.5 weeks).

> **Why T12 is in the core MVP:** without it, every persisted quotation keeps
> storing base64 image bytes in the JSONB body — the known 413 save-breaker —
> and the external image URLs it depends on expire, so reloaded quotations show
> broken images. Draft persistence (T3/T6) makes reload a first-class flow, which
> makes the expiring-URL problem actually user-visible. T12 is what makes saved
> quotations durable.

---

## Effort & risk summary

> ⚠️ **Inside-view estimate.** No historical base rate exists for feature efforts
> in this project yet, so treat these as rough and apply a **1.3–1.5×** buffer on
> the total. **Total ≈ 24–37 ideal days → plan 7–10 weeks; core MVP ≈ 3.5–4.5 weeks.**

| # | Task | Est. | Risk |
|---|------|------|------|
| T1 | Roles foundation | 1.5–2.5 d | Med (security + migration) |
| T2 | Authz test coverage | 1–1.5 d | Low |
| T3 | Draft model + migration | 2–3 d | Med-High |
| T4 | Delete mutation (soft) | 1–1.5 d | Low |
| T5 | Finalize (draft→final) | 1.5–2.5 d | Med |
| T6 | Enable My Quotations + list polish | 2–3 d | Low-Med |
| T7 | List filters / search | 1.5–2.5 d | Low-Med |
| T8 | Free-template creation path | 1.5–2.5 d | Med |
| T8b | Required-elements validator (standard-flow only) | 1–1.5 d | Med |
| T9 | Client/contact CRUD + null-client drafts | 1.5–3 d | Med |
| T10 | Autosave for drafts (optional) | 1–2 d | Med |
| T10b | Retire `isDraft` band-aid | 1–1.5 d | Low-Med |
| T11 | i18n, empty states, e2e specs for module flows | 2.5–4 d | Low-Med |
| T12 | Image object storage (Supabase) + dedup/TTL + cache | 4–6 d | Med-High |

---

## T1 — Roles foundation — **DECISION PENDING (D4)**

Wire the `admin`/`user` role through the stack. The authorization *seam* already
exists — this is wiring, not architecture.

- **Context:** `src/server/auth/access.ts` → `canAccessAllQuotations(session)`
  currently returns `true` (stub). `src/server/auth/config.ts` has a commented
  `role: UserRole` augmentation stub in the `Session` module augmentation.
- **Files:** `src/server/db/schema.ts` (add `users.role`), a new Drizzle
  migration, `src/server/auth/config.ts` (session/JWT callback + augmentation),
  `src/server/auth/access.ts` (flip the seam), the seed scripts + bulk-user CSV
  importer, `src/i18n/messages.ts` (role labels if surfaced).
- **Change:**
  1. Add `role` column to `users`: `varchar`/enum `'admin' | 'user'`, `.notNull()
     .default('user')`. (Additive column with a default → safe migration.)
  2. Surface `role` in the session (JWT strategy — see the `session`/`jwt`
     callbacks) and uncomment/complete the `Session["user"].role` augmentation.
  3. `canAccessAllQuotations` → `return session.user.role === 'admin'`.
  4. Seed + bulk CSV: accept an optional `role` column (default `user`); document
     in README's CSV section.
- **Acceptance:**
  - A user seeded `admin` sees all quotations via `list`; a `user` sees only
    their own (verified in T2 tests).
  - Session type exposes `user.role` with no `any`/casts.
  - Existing sessions/users default to `user` after migration.
- **Risk:** Med — touches auth + a live-table migration. Mitigation: additive
  column with default; add the authz tests (T2) before relying on the flip.

## T2 — Authorization test coverage

Close the known gap: `list`/`byId` have **no tests** today, and role changes
touch security-sensitive paths.

- **Files:** new `src/server/api/routers/quotation.test.ts` (or colocated).
- **Change:** unit-test `list`, `byId`, `save` (ownership), and `delete` (T4)
  for both roles: `user` sees/mutates only own rows; `admin` sees/mutates all;
  non-owner `user` gets `null`/throws as designed. Mock the tRPC `ctx` (db +
  session) following the project's existing router-test seam.
- **Acceptance:** ownership + role matrix covered; `pnpm test` green (minus the
  known unrelated failure).
- **Risk:** Low (additive). **Do before shipping T1.**

## T3 — Draft model + migration — **DECISION PENDING (D1, D2, D5, D7)**

Introduce drafts as first-class state on `quotations`, reusing the existing
save/list/byId plumbing.

- **Files:** `src/server/db/schema.ts`, new migration, `quotation.ts` router,
  `quotation-list.tsx` + list query shape.
- **Change (recommended defaults):**
  1. Add columns to `quotations`:
     - `status` `'draft' | 'final'`, `.notNull().default('draft')` (D1).
     - `templateKind` `'standard' | 'free'`, `.notNull().default('standard')` (D7).
     - `deletedDate` timestamp nullable (for T4 soft-delete).
     - Make `quotationNumber` **nullable** and stop firing the sequence on insert;
       the number is assigned at finalize (D2). *This is the one non-trivial
       migration — the column currently is `notNull` + `unique` with a
       `DEFAULT nextval(...)`. Per project memory, hand-edit the generated SQL for
       this change.*
     - Make `clientId` remain nullable (it already is) so drafts can exist without
       a client (D5).
  2. `save`: accept `status`/`templateKind`; drop the hard "client required"
     precondition for **drafts** (require it only at finalize, T5). Keep ownership
     checks.
  3. `list`: exclude `deletedDate IS NOT NULL`; return `status`, `templateKind`,
     and (nullable) `quotationNumber` so the UI can badge drafts/free docs.
- **Acceptance:**
  - Create/update/retrieve a draft with no client and no number; it appears in
    `list` badged as a draft; it is NOT counted as finalized.
  - Migration applies cleanly on a seeded dev DB (`pnpm db:migrate:dev`) and the
    `quotationNumber`-nullable change preserves existing rows (they are all
    `final` with a number).
  - Round-trip (save→load) of a draft is lossless (rides on imp Task 2.1 schema).
- **Risk:** Med-High — the nullable-number migration on a `unique`+`notNull`
  column with a sequence default. Mitigation: hand-edit SQL (project memory on
  Drizzle type/constraint changes), test on dev first, confirm existing rows.

## T4 — Delete mutation (soft) — **DECISION PENDING (D3, D4)**

- **Files:** `quotation.ts` (new `delete` procedure), `quotation-list.tsx`
  (delete action + confirm), `messages.ts`.
- **Change:** `quotation.delete` sets `deletedDate = now()` (soft). Gate:
  owner always; non-owner only if `admin` (D3/D4). `list`/`byId` already exclude
  soft-deleted after T3. Add a confirm modal (reuse the app's modal pattern, not
  `alert`).
- **Acceptance:** owner soft-deletes own; admin soft-deletes any; `user` cannot
  delete another's (covered in T2); deleted rows vanish from `list`/`byId`.
- **Risk:** Low.

## T5 — Finalize (draft → final) — **DECISION PENDING (D2, D5, D7)**

The draft→final transition is a guarded state change, not a boolean flip.

- **Files:** `quotation.ts` (new `finalize` procedure or a `status` arg on
  `save`), `setQuotationNumber` (free-template fallback), editor finalize action,
  `messages.ts`.
- **Change:**
  1. `finalize(id)`: require a valid owned `clientId` (D5), require ≥1 page,
     assign the permanent `quotationNumber` via the sequence (D2), set
     `status = 'final'`.
  2. `setQuotationNumber` currently targets the `quotation-number` **role**
     element; a **free** template may lack one — add a no-op fallback (don't throw;
     the number still lives in the relational column) (D7).
  3. Decide finality semantics (document in the task): finalized quotations are
     **editable** but keep their number (recommended), vs. locked. Default:
     editable.
- **Acceptance:** finalizing a draft assigns a unique number and flips status;
  finalizing a **free** doc with no number element does not crash and still gets a
  relational number; finalize without a client is rejected with an actionable
  (non-500) message.
- **Risk:** Med.

## T6 — Enable My Quotations + list polish — **DECISION PENDING (D7)**

Make the module reachable and render drafts / free / admin views gracefully.

- **Files:** `src/app/_my-quotations/page.tsx` (`ENABLE_QUOTATIONS_PAGE`),
  `quotation-list.tsx`, nav (`nav-bar.tsx`), `messages.ts`.
- **Change:**
  1. Flip `ENABLE_QUOTATIONS_PAGE = true`; add the nav entry
     (`nav.myQuotations` already exists in `messages.ts`).
  2. List polish: status badge (draft/final), `templateKind` badge
     (standard/free), owner column **when admin** (the `list` query already
     returns `userName`). Render **0-product / free** docs gracefully — a free
     doc has `productCount = 0` and empty `references`; show a "custom" label, not
     an error/empty state.
  3. Open action already stashes the id and navigates to `/editor` (exercises the
     built `useQuotationLoad`). Verify the dirty-overwrite confirm modal works
     now that the path is reachable.
- **Acceptance:** signed-in user reaches `/my-quotations` via nav; sees own
  quotations (admin sees all with owner column); drafts/free docs render with
  correct badges and no false-empty states; opening loads into the editor.
- **Risk:** Low-Med (first time the load path runs end-to-end).

## T7 — List filters / search

- **Files:** `quotation.ts` (`list` input), `quotation-list.tsx` (filter UI),
  `messages.ts`.
- **Change:** add filters to `list`: by `status`, `templateKind`, owner (admin
  only), date range; and search by `quotationNumber` / client name. Keep the
  existing offset pagination.
- **Acceptance:** each filter narrows results correctly; search by number/client
  works; pagination still correct under filters.
- **Risk:** Low-Med. **Optional for core MVP** (defer to Phase 2.1 if needed).

## T8 — Free-template creation path — **DECISION PENDING (D7)**

Let users start a quotation from a blank/free canvas instead of the fixed
per-page standard template.

- **Context:** the storage layer is already template-agnostic (imp Task 2.1) and
  reasons by `role` (imp Task 3.5). A `setPendingManualQuotation` seam already
  exists for blank *item fields* — extend the concept to a blank *document*.
- **Files:** editor new-quotation entry (`editor-client.tsx` seeding branch),
  `src/lib/quotation-load.ts` (a `free`/`blank` handoff flag), the creation
  entry UI, `templateKind` plumbing to `save`/`finalize`.
- **Change:** add a "start blank / free template" entry that seeds an empty (or
  minimal) document and marks `templateKind = 'free'`; the standard entry keeps
  seeding the master template (`templateKind = 'standard'`). **Do not add new id
  `startsWith` checks** — use `role` (per `AGENTS.md` + imp Task 3.5).
- **Acceptance:** a free quotation can be created, edited, saved, listed (badged
  `free`), and reloaded losslessly; the standard flow is unchanged.
- **Risk:** Med (touches the editor seeding area). Lowered by the completed
  Phase 3 decomposition.

## T8b — Required-elements validator (standard-flow only) — folds in imp Task 2.3

Enforce the "always-present" invariant (header fields + policies page) **only**
on the standard-template flow — never on the universal/free save path.

- **Why here:** imp Task 2.3 was explicitly deferred into this module so it can
  be built and verified against a real enforced flow. **It must not leak into the
  universal save path**, or free/round-trip saves break (the standing warning in
  the improvements plan).
- **Files:** new `src/app/editor/_lib/required-elements.ts`
  (`findMissingRequiredElements(doc)` / `requiredElementsPresent(doc)` +
  `REQUIRED_ELEMENT_IDS`/roles), wired **only** into the standard-template
  creation + finalize path, `messages.ts`.
- **Required roles (re-verify against `_lib/template-data.ts` at build time):**
  `customer-name`, `company-name`, `quotation-number`, `representative-info`,
  `footer`, and the final-page `policies-body`.
- **Change:** pure validator (unit-tested); call it in the **standard** finalize
  flow only, surfacing an actionable (non-500) message. Free docs skip it
  entirely.
- **Acceptance:**
  - A standard doc missing a header field or policies page fails the enforced
    check with a clear message.
  - A **free** doc still saves/finalizes fine through the universal path.
  - Tests: present → ok; missing header → reported; missing policies → reported;
    free-form → reports nothing / is not called.
- **Risk:** Med — the leak risk above. **Depends on:** imp Task 2.1, T5, T8.

## T9 — Client / contact CRUD + null-client drafts — **DECISION PENDING (D5, D8)**

- **Context:** `clients` / `clientContacts` tables exist; `save` requires an
  owned `clientId`. Drafts should allow a null client until finalize (D5).
- **Change:** **first verify** the current client/contact create/pick/edit
  surface (D8), then scope: complete any missing CRUD and allow drafts with no
  client; finalize enforces client presence (T5).
- **Acceptance:** a draft can be created with no client; a client/contact can be
  created and picked; finalize blocks until a client is set.
- **Risk:** Med (scope depends on current CRUD completeness — verify first).

## T10 — Autosave for drafts (optional) — **DECISION PENDING (D6)**

- **Context:** `useQuotationPersistence` already owns the save mutation and the
  save-race `editRevisionRef` seam (imp Task 3.3) — autosave builds on it.
- **Change (if adopted):** debounced autosave for `status = 'draft'` (on blur or
  interval), reusing `handleSave`; must respect the in-flight `editRevisionRef`
  race handling so edits made during a save aren't clobbered.
- **Acceptance:** edits to a draft persist without an explicit save; no lost
  edits under rapid typing (race preserved); final docs unaffected.
- **Risk:** Med (save-race interaction). **Default: deferred (D6).**

## T10b — Retire the `isDraft` band-aid — folds in the imp Phase 5 note

- **Context:** `editor-client.tsx` derives `isDraft` from **consume-on-read
  sessionStorage** handoffs captured once at mount, which is fragile across tab
  duplicate/clone/refresh. The improvements plan flagged the durable fix as *real
  draft persistence* — i.e. this module.
- **Change:** once drafts persist (T3) and load (T6), re-derive `isDraft` from the
  **loaded content / draft status**, not one-shot mount flags. Re-check the other
  sessionStorage-reading initializers in `editor-client.tsx` (`isManualStart`,
  `hasInitialProducts`, `pendingHomeContactIdRef`, initial pages/meta) for the
  same SSR/clone hydration trap.
- **Acceptance:** draft protection (beforeunload + in-app nav guard) survives tab
  clone/refresh; the `beforeunload`/nav guards still fire for genuinely-dirty
  editors; no hydration-mismatch regression on the Save button.
- **Risk:** Low-Med. **Depends on:** T3, T6.

## T11 — i18n, empty states, and e2e specs for module flows

- **Context:** Phase 6 of the improvements plan (Playwright) **explicitly
  excludes** My Quotations because it was flag-gated off. Now that the module is
  reachable, it owns its own e2e coverage on top of that harness (imp Task 6.0).
- **Change:**
  1. All new UI strings in both locales (`messages.ts`); graceful empty states
     (no quotations, no drafts, no search results).
  2. E2e specs (reusing the imp Task 6.0 harness + cleanup scoped to the e2e
     `user_id`): list → open → edit → save; create draft → finalize; soft-delete;
     free-template create → save → reload; role visibility (admin sees all vs.
     user sees own).
- **Acceptance:** both locales complete; empty/error states render; the module's
  happy paths pass under `pnpm test:e2e` with zero residual rows after teardown.
- **Risk:** Low-Med. **Depends on:** imp Task 6.0 (harness), and the module tasks
  the specs exercise.

---

## T12 — Product image object storage + dedup/TTL + cache — **DECISION PENDING (D9–D13)**

Stop persisting short-lived external image URLs (and base64 blobs) inside the
quotation document. Store each product image once in **Supabase Storage**, keep
only a durable (same-origin) URL in the element `src`, and avoid re-storing an
image that's already stored within a configurable freshness window.

- **Why:** the external API's `imageUrl`s expire, so a reloaded quotation shows
  broken images; and today the editor persists images as **base64 data URLs**
  (`isAllowedImageSrc` accepts `data:image/...`), which inflate the save body by
  ~33% and are the **#1 cause of the 4.5 MB 413 save failure** (see
  [`quotation-size-limits.md`](./quotation-size-limits.md) §1 + Mitigation #1).
  Draft persistence (T3/T6) makes reload a first-class flow, so this becomes
  user-visible. **No Supabase Storage client is wired yet** — only the Postgres
  connection exists.

- **Current state (verified 2026-11-03):**
  - External images come from `firstImageUrl` → `resolveSkus`, on `amazonaws.com`
    hosts (`ALLOWED_IMAGE_HOST_SUFFIXES`).
  - `/api/image?url=` is a same-origin **read-proxy** (`parseAllowedImageUrl`,
    host allowlist, `cache-control: immutable, max-age=86400`) that already
    solves CORS + canvas-taint for PDF export.
  - `src/lib/product-image.ts` (`proxiedImageUrl`) rewrites external URLs to the
    proxy; `useLoadedImage` + the save schema both enforce `isAllowedImageSrc`.
  - Persisted `src` today is base64 (editor page-builder embeds it), NOT a URL.

- **Sub-tasks:**

  - **T12.1 — Storage client + bucket + env (foundation).** Add the Supabase
    Storage client (`@supabase/supabase-js`, pinned) and a server-only
    `src/server/storage/` module (`putProductImage`, `getPublicUrl`). Add env
    vars to `src/env.js` + `.env.example` (`SUPABASE_URL`,
    `SUPABASE_SERVICE_ROLE_KEY` — **server-only, never client**, and the bucket
    name). Create the bucket (document the manual/console step; it's not a DB
    migration). *Est. 1–1.5 d. Risk: Med (new secret + infra).* **DECISION: D12.**

  - **T12.2 — Image registry table + dedup (D10, D11).** Add a
    `product_image` table: `id`, `hash` (content hash, unique — the dedup key),
    `sourceUrl`, `storagePath`, `contentType`, `bytes`, `createdDate`,
    `lastFetchedDate`. A new migration. Pure helper
    `shouldRefetch(lastFetchedDate, now, refreshWindow)` in `_lib` WITH unit
    tests. Dedup logic: given a source URL, if a row exists and is within the
    freshness window (`IMAGE_REFRESH_DAYS`, default 30 — D11), reuse its
    `storagePath`; otherwise (re)fetch, hash, and upsert. The **hash** dedupes
    identical bytes even across differing URLs (D10). *Est. 1–1.5 d. Risk: Med.*

  - **T12.3 — Ingest pipeline (server).** A server procedure/helper
    `ensureStoredImage(sourceUrl)` that: checks the registry (T12.2) → if stale
    or missing, fetches via the existing proxy/allowlist path, hashes, uploads to
    Supabase (T12.1), upserts the registry row → returns the durable `src`
    (per D9). Wire it where the document is built/saved so persisted `src` is the
    stored URL, not base64 or the expiring external URL. Reuse the existing host
    allowlist as the SSRF boundary. *Est. 1.5–2 d. Risk: Med-High (the core
    behaviour change; must stay lossless with imp Task 2.1).*

  - **T12.4 — `src` allowlist + render path (D9).** Make persisted `src`
    **same-origin via `/api/image`** (recommended: `isAllowedImageSrc` already
    accepts `/...`, so the save schema needs **no change**) OR allowlist the
    Supabase public-bucket host in both `isAllowedImageSrc` (save schema) and
    `ALLOWED_IMAGE_HOST_SUFFIXES` (proxy). Verify `useLoadedImage` + PDF export
    (canvas taint) still work against the chosen host. *Est. 0.5–1 d. Risk: Med
    (two enforcement points must agree — see size-limits doc §2 note).*

  - **T12.5 — Cache.** Lean on what exists: the `/api/image` proxy already sends
    `immutable, max-age=86400`; stored objects are content-addressed (hash in the
    path) so they're safely cacheable forever. Add a storage-side cache header if
    serving the bucket directly. Optionally a small in-request memo so one save
    with the same image N times ingests once. *Est. 0.5 d. Risk: Low.*

  - **T12.6 — Backfill / migration of existing base64 (optional).** A one-off
    script that walks existing quotations, extracts `data:` images, stores them,
    and rewrites `src` to the durable URL. *Est. 0.5–1 d. Risk: Med (touches
    stored docs — dev-first, reversible, behind a dry-run flag).* **May defer.**

- **Out of scope for v1 (document, don't build) — D13:** orphan cleanup
  (images no longer referenced by any quotation), user-uploaded images, and
  signed direct-to-storage upload (D12 keeps server-side ingest for now).

- **Acceptance:**
  - A saved quotation stores a **durable URL** in every image `src` — no `data:`
    base64 and no raw expiring external URL; reloading it days later renders all
    images (source-URL expiry no longer matters).
  - Saving the same product image twice within the freshness window performs
    **one** upload (verify via registry row count / `lastFetchedDate`); after the
    window, the source is re-fetched and the row updated.
  - `shouldRefetch` has unit tests (fresh → reuse; stale → refetch; boundary).
  - Save body for an image-heavy quotation drops well under 4.5 MB (the 413 class
    becomes structurally impossible, per Mitigation #1).
  - `SUPABASE_SERVICE_ROLE_KEY` is server-only (not in any client bundle);
    `isAllowedImageSrc` and the proxy allowlist agree on the chosen host.
  - PDF export still produces untainted-canvas images for stored URLs.

- **Risk:** Med-High overall — new secret/infra, a behaviour change on the
  persisted `src`, and two allowlist enforcement points that must stay in sync.
  Mitigation: same-origin proxy (D9) minimizes the allowlist blast radius; the
  ingest is additive and the backfill (T12.6) is dev-first + reversible.

- **Depends on:** imp Task 2.1 (lossless schema — stored URL must round-trip),
  imp Task 2.2 (`isAllowedImageSrc`), and T3/T6 (reload is what makes durability
  matter). Best sequenced **after** T6 so there's a real reload flow to verify
  against.

---

## Dependency notes

- **T1 → T2:** flip the role seam, then lock it with tests before relying on it.
- **T3 is the backbone:** T4 (soft-delete column), T5 (number deferral), T6
  (badges) all read the columns T3 adds. Sequence T3 early.
- **T5 + T8 → T8b:** the required-elements validator needs both the finalize flow
  (T5) and the standard-vs-free distinction (T8) to wire correctly.
- **T3 + T6 → T10b:** `isDraft` can only be re-derived from content once drafts
  persist and load.
- **T6 → T12:** image durability only matters once reload is a first-class flow;
  sequence T12 after T6. T12.1 (storage foundation) has no module dependency and
  can start in parallel.
- **imp Task 6.0 → T11:** the e2e harness (Playwright config, auth fixture,
  DB-cleanup, external-API mock) is a hard prerequisite for the module e2e specs.
- **Do NOT leak T8b into the universal save path** — the single biggest
  correctness risk for free templates (standing warning from imp Task 2.3).
- **T12 keeps `src` same-origin (D9)** so `isAllowedImageSrc` stays unchanged;
  if you allowlist the bucket host instead, update BOTH enforcement points
  (save schema + proxy allowlist) together (size-limits doc §2).
