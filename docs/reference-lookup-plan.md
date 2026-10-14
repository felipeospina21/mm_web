# Implementation Plan — Stage 1: Reference-Lookup Quotation Builder

> Status: **Planned — not yet implemented.** This is the agreed blueprint for the
> *simpler* next step of the POC. It supersedes, as the immediate priority, the
> larger ETL/catalog plan in [`docs/etl-sync-and-api-plan.md`](./etl-sync-and-api-plan.md),
> which is now **Stage 2** (a later, heavier implementation). Stage 1 reuses the
> same foundations (Supabase, Zod firewall, external API client) at a much smaller
> scope and leaves the Stage 2 plan valid for when catalog sync is needed.

## Scope change (why this document exists)

The POC pivots from a **catalog-browse-and-pick** flow to a **reference-lookup**
flow. Instead of browsing a seeded product catalog and clicking cards, the user
pastes a comma-separated list of product references, we resolve them against an
external API on demand, and load the returned product details straight into the
quotation editor. There is **no local product catalog** and **no scheduled ETL**
in Stage 1 — products are fetched live, per quotation, and only the finished
**quotation** is persisted.

### Two views only

| View | Route | State | Stage 1 work |
|------|-------|-------|--------------|
| **Home / reference input** | `/` | *replaced* — currently a product catalog | New: references textarea → external API lookup → load into editor |
| **Quotation editor** | `/editor` | exists, needs refinement | Refine; keep its product/quotation data contracts |

> The existing **My Quotations** page (`/my-quotations`) and quotation
> persistence (save / list / load) already exist and are **kept as-is** in
> Stage 1. They are not part of the scope change.

## What already exists (confirmed in code)

- **Quotation persistence** — the `mm_web_quotation` table (`src/server/db/schema.ts`),
  the `quotation` tRPC router (`save` / `list` / `byId`, owner-scoped, serial
  `quotation_number`), the My Quotations list, and editor load/hydrate via
  `src/lib/quotation-load.ts`. **No new quotation schema is needed.**
- **The editor** (`src/app/editor/page.tsx` + `_components/`) — Konva canvas,
  undo/redo, PDF export (client-side jsPDF), save. It builds pages from a
  `QuotationData` (`meta` + `products`) via `buildPagesFromQuotation`
  (`template-data.ts`).
- **The product→editor handoff seam** — the home page writes picked products to
  sessionStorage as `QuotationProduct[]` (`src/lib/quotation-selection.ts`); the
  editor reads them on mount (`getQuotationProducts()`) and maps them into the
  quotation `meta`. **Stage 1 keeps this exact seam** — only the *source* of the
  products changes (external API instead of catalog cards).
- **Supabase foundation** — `DATABASE_URL` (pooled) + `DIRECT_URL` (direct),
  `prepare: false`, Docker-as-test-DB. Already in place (Epic 0 of Stage 2 is
  effectively done). Stage 1 does **not** touch env/DB plumbing beyond adding the
  external API vars (Epic 2) — the catalog tables stay (they feed hidden
  `/catalog`).

## What changes vs. the old plan

| Old (Stage 2) | Stage 1 |
|---------------|---------|
| Full paginated ETL sync (53 + 169 pages) | Live, on-demand lookup of a short reference list |
| GitHub Actions cron scheduling | None — fetch happens in the user's request |
| Normalized catalog schema (categories, images, attributes, `sync_runs`) | None — nothing persisted but the quotation |
| `product.list` / `search` / faceted filtering over local tables | Catalog kept on a hidden `/catalog` route; new `/` uses a single `product.resolveReferences` lookup via the external API |
| Local `products` / `product_variants` tables + demo seed | **Kept** (feed the hidden `/catalog`); quotation table stays |
| Server-side PDF (design-first) | Deferred to Stage 2 (client-side jsPDF stays) |

The **external API client** and the **Zod firewall** from Stage 2 are still built
in Stage 1 — just scoped to a single by-SKU lookup instead of a full paginated
crawl. This keeps Stage 1 and Stage 2 architecturally aligned.

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    H["/ — SKUs textarea<br/>'cp-10, au 20 4, xtron'"] -->|parse to string[]| RT
    RT[product.resolveReferences<br/>tRPC query] -->|QuotationProduct[]| SS[sessionStorage<br/>quotation-selection]
    SS --> ED["/editor — Konva canvas<br/>buildPagesFromQuotation"]
    ED -->|save| QT[quotation.save]
  end
  RT -->|server| API["src/server/external/<br/>fetch -> Zod firewall -> normalize"]
  API -->|"bearer header, GET ?skus=a,b,c (≤20)"| EXT[(External aggregator API<br/>products endpoint)]
  QT --> DB[(Supabase Postgres<br/>mm_web_quotation only)]
```

**The lookup endpoint (confirmed)**

The products endpoint accepts a `?skus=` query param: a **comma-separated list of
up to 20 SKUs**. So the "reference" the user types **is a SKU**, the lookup is a
**single batched request** (no fan-out), and lists longer than 20 must be
**chunked into batches of 20**.

**Key design decisions**

- **A "reference" is a SKU.** The textarea input is parsed into SKUs and passed as
  the `?skus=` list; `unresolved` = requested SKUs absent from the response.
- **Reuse the `QuotationProduct` contract** (`src/lib/quotation-selection.ts`) as
  the output shape of the lookup. The editor already consumes it, so no editor
  data-flow changes are needed to get products onto the canvas.
- **Batch at 20.** One request per ≤20 SKUs; chunk longer lists and merge
  responses. (Expected lists are short, but the chunker keeps us correct and lets
  us cap total SKUs if desired.)
- **Lookup is a tRPC query on the server** (`product.resolveReferences`), not a
  client-side fetch, so the external API token never reaches the browser and the
  Zod firewall runs server-side.
- **Live, no persistence of products.** Each quotation captures a point-in-time
  snapshot of product details inside its own `data` JSONB (already how the editor
  saves). The `quotation.references` column (already exists) stores the raw SKUs.
- **Partial resolution is a first-class result.** Some SKUs won't resolve; the
  lookup returns `{ resolved, unresolved }` so the UI can show which codes were
  found and let the user proceed with the ones that were.
- **Keep client-side jsPDF.** Server-side PDF stays a Stage 2 concern.

---

## Epic 1 — Move the catalog to a hidden `/catalog` route

Rather than delete the catalog-browse surface, **relocate it to a hidden
`/catalog` route** so it stays fully functional and recoverable if we revisit it.
It is "hidden" only in that nothing links to it (not in the nav); typing the URL
still works. All catalog code, the `product` tRPC router, the
`products`/`product_variants` tables, and the demo seed are **kept**.

- [ ] **Task 1.1:** Create `src/app/catalog/page.tsx` containing the current
  **signed-in** content of `src/app/page.tsx`: the `product.list` server prefetch,
  `<ProductCatalog />` (hydrated), and the floating `<QuotationBar />`. Keep the
  header ("Product Catalog"). The signed-out branch (login) does **not** move — a
  signed-out visit to `/catalog` should redirect to `/` (reuse the existing
  `auth()` guard pattern). _Test:_ `pnpm typecheck`/`lint` clean. _Demo:_
  `/catalog` renders the existing catalog + selection flow for a signed-in user.
- [ ] **Task 1.2:** Keep all catalog building blocks **in place and unchanged**:
  `_components/product-catalog.tsx`, `_components/product-card.tsx`,
  `_components/quotation-bar.tsx`, the `product` tRPC router (`list`/`byId`), the
  `products` + `product_variants` tables, and the demo seed
  (`scripts/seed-products.mjs`, `db:seed:products`). No schema drop, no seed
  removal in Stage 1. _Demo:_ Studio still shows the catalog tables; `/catalog`
  works end-to-end.
- [ ] **Task 1.3:** Keep `QuotationProduct` / `QuotationProductVariant` and the
  sessionStorage helpers (`getQuotationProducts`, `addQuotationProduct`,
  `clearQuotationProducts`, `STORAGE_EVENT`) exactly as-is — they are shared by
  both the hidden catalog's card selection **and** the new reference-lookup
  handoff. `/` (Epic 5) will own the same sessionStorage keys. _Test:_ both the
  catalog flow and the lookup flow write the same `QuotationProduct[]` shape.
  _Demo:_ picking on `/catalog` and loading via `/` both open the editor
  identically.

## Epic 2 — External API client (SKU batch lookup)

A thin, typed, server-only client scoped to the `?skus=` batch endpoint.

- [ ] **Task 2.1:** Add `EXTERNAL_API_BASE_URL` + `EXTERNAL_API_TOKEN` to
  `src/env.js` (server vars) and `.env.example`, documented alongside the DB
  vars. _Test:_ env validation passes with the new vars present; fails clearly
  when `EXTERNAL_API_BASE_URL` is not a URL. _Demo:_ app boots with the vars set.
- [ ] **Task 2.2:** Create `src/server/external/client.ts`: a typed `fetch`
  wrapper that attaches the bearer/API-key header, applies a timeout, and does
  bounded retry/backoff on 5xx/network errors. _Test:_ correct URL + auth header
  (mocked `fetch`); retries then surfaces an error after N attempts. _Demo:_
  a mocked call logs the request shape.
- [ ] **Task 2.3:** `fetchProductsBySkus(skus: string[])` in
  `src/server/external/products.ts` — builds `GET {base}/products?skus=a,b,c`
  (URL-encoded, comma-joined), **chunking into batches of ≤20** and merging the
  responses, and returns the raw product payloads keyed by SKU. _Test:_ a ≤20 list
  issues one request; a 21+ list issues two chunked requests and merges; the
  `skus` param is correctly comma-joined/encoded (mocked `fetch`). _Demo:_ resolve
  a 3-SKU list (mock) returns 3 raw entries from a single request.

## Epic 3 — Zod firewall + normalization (SKU payloads)

Reuse the Stage 2 firewall idea at single-product scope: sanitize the messy
aggregator payload and emit a clean `QuotationProduct`.

- [ ] **Task 3.1:** `productFromExternal` Zod schema + transform in
  `src/server/external/schema.ts`: handle the known payload quirks (stringified
  `images`, `tags`, `printing_methods`; number/string prices → formatted price
  string; variant `attributes` map; non-ISO timestamps) and `.strip()` the rest.
  Output maps 1:1 onto `QuotationProduct` (`id`, `name`, `reference` (= `sku`),
  `price`, `description`, `variants[]`). _Test:_ a sample payload from
  `docs/api_example.md` → clean `QuotationProduct`; malformed fields produce
  captured warnings, not throws. _Demo:_ one sample product normalized.
- [ ] **Task 3.2:** Variant normalization → `QuotationProductVariant[]`
  (`colorName`, `colorHex`, `stock`, `packaging`), tolerating the variant-level
  shape differences (flat `{Color:"Rojo"}` attribute map, missing hex → derive or
  default). _Test:_ variants with/without color + stock normalize safely. _Demo:_
  a multi-variant product yields a correct inventory-table-ready variant list.

## Epic 4 — `product.resolveReferences` tRPC procedure

- [ ] **Task 4.1:** Add a `product` router procedure
  `resolveReferences({ references: string[] })` (protected) that runs the client
  (Epic 2) + firewall (Epic 3) server-side and returns
  `{ resolved: QuotationProduct[]; unresolved: string[] }`. Dedupe + trim the
  input SKUs; `unresolved` = requested SKUs absent from the API response. Cap the
  list length (align with the API's 20-per-request limit, e.g. chunk or reject
  beyond a sane max). _Test:_ all-resolve, partial-resolve, all-unresolved cases;
  input dedupe/trim; length cap/chunking enforced. _Demo:_ query a mixed list
  returns resolved + unresolved split.
- [ ] **Task 4.2:** SKU-parsing helper (shared, `src/lib/references.ts`):
  split a raw string like `"cp-10, au 20 4, xtron"` on commas, trim, drop empties,
  dedupe, preserve user order. _Test:_ comma/space/empty/duplicate edge cases.
  _Demo:_ parse the example string → `["cp-10", "au 20 4", "xtron"]`.

## Epic 5 — New home page (reference input view)

Replace the catalog home with the reference-lookup view.

- [ ] **Task 5.1:** Rebuild `src/app/page.tsx` (signed-in branch) as the
  reference-input view: a labeled textarea (placeholder
  `"cp-10, au 20 4, xtron"`), a "Load into editor" button, and inline help noting
  SKUs are comma-separated and up to 20. Keep the signed-out branch (login form)
  unchanged. _Demo:_ signed-in users see the input view; signed-out users still
  see login.
- [ ] **Task 5.2:** Wire the button to `product.resolveReferences` (via
  `api.product.resolveReferences`): parse the textarea (Task 4.2), call the query,
  show a loading state, then render a **resolution summary** — resolved products
  (name + reference + variant/stock chips) and an "unresolved" list for codes that
  didn't match. _Test:_ loading, resolved, partial, empty, and error states
  render. _Demo:_ paste a list → see resolved + unresolved breakdown.
- [ ] **Task 5.3:** On "Load into editor", write the resolved
  `QuotationProduct[]` to sessionStorage (`clearQuotationProducts()` then
  `addQuotationProduct` for each) and navigate to `/editor`. The editor's existing
  `getQuotationProducts()` → `buildPagesFromQuotation` path renders them with no
  editor changes. _Test:_ sessionStorage holds the resolved set; navigation
  occurs. _Demo:_ load a list → editor opens with one page per resolved product +
  inventory tables populated.
- [ ] **Task 5.4:** Update the nav bar / layout: rename the `/` link from
  "Catalog" to "New quotation" (it now points at the reference-input home), keep
  "Editor" and "My Quotations". **Do not** add a nav link for `/catalog` — it
  stays hidden. The floating `QuotationBar` moves with the catalog to `/catalog`
  (Task 1.1) and is not shown on `/`. _Test:_ `pnpm lint` clean; no dead links;
  nav has no `/catalog` entry. _Demo:_ nav reflects the two-view model while
  `/catalog` remains reachable by URL.

## Epic 6 — Editor refinements

Scoped polish on the existing editor (not a rewrite). Exact items to be confirmed,
but the plan reserves this epic for the "needs refinement" note.

- [ ] **Task 6.1:** Handle the **empty / direct-visit** case: opening `/editor`
  with no resolved products (and no pending load) shows the empty quotation with a
  clear "add products from the home page" affordance rather than a bare template.
  _Demo:_ visiting `/editor` cold is self-explanatory.
- [ ] **Task 6.2:** Surface **unresolved references** in the editor if any were
  carried over (optional banner: "3 of 4 references loaded"). _Demo:_ partial
  loads are visible in the editor.
- [ ] **Task 6.3:** Agreed UI/UX refinements to the canvas/toolbar (collect the
  concrete list before implementing — placeholder for the "refine the editor"
  requirement). _Demo:_ reviewed refinements applied.

## Epic 7 — Docs & cleanup

- [ ] **Task 7.1:** Update `README.md`: the app is now a reference-lookup
  quotation builder (two primary views: `/` + `/editor`), with the product catalog
  retained on a hidden `/catalog` route (reachable by URL only). Document
  `EXTERNAL_API_BASE_URL` / `EXTERNAL_API_TOKEN`, note the catalog + seed scripts
  still exist but feed only `/catalog`, and point Stage 2 (ETL/catalog) at
  `docs/etl-sync-and-api-plan.md`. _Demo:_ README matches the Stage 1 app.
- [ ] **Task 7.2:** Cross-link: add a short "Stage 1 vs Stage 2" note at the top of
  `docs/etl-sync-and-api-plan.md` pointing here. _Demo:_ both plans reference each
  other.

---

## Open items to resolve at implementation time

- **`?skus=` response shape**: confirm the by-SKU response matches the *list*
  payload documented in `docs/api_example.md` (same product/variant structure and
  quirks). Need a sample response for a `?skus=` query to lock down Task 3.1.
- **SKUs beyond 20**: the UI should either cap input at 20 SKUs or let Task 2.3's
  chunker transparently issue multiple requests. Decide which (product call) —
  the plan supports both.
- **Variant color hex**: the external payload's variant may not carry a hex color,
  but the inventory table renders a swatch — confirm whether we derive/default it
  (Task 3.2). (The catalog table's `#RRGGBB` check still exists but only governs
  locally-seeded catalog rows, not externally-sourced lookup results.)
- **Editor refinement list** (Task 6.3): concrete UX items to confirm before
  building.
- **Price formatting**: the editor expects a formatted string (e.g.
  `"$12,500.00"`); confirm COP formatting rules for externally-sourced prices.
