# Quotation size limits & failure points

A reference for where a quotation can break when it grows large — by pages,
elements, text, tables, styles, or images. Numbers marked _(estimate)_ are
back-of-envelope figures to reason with, not exact thresholds. The **hard**
limits are either enforced by code (the Zod schema) or by the platform.

> TL;DR: the only realistic way to break a save today is **image bytes in the
> payload** (the 4.5 MB Vercel body limit). With images removed from the body,
> a normal quotation sits at ~1–2% of the limit; you'd need a thousand-plus
> ordinary pages, or a deliberately huge table, to get near it.

---

## 1. The binding limit: request body size (the 413)

| What | Value | Source |
| ---- | ----- | ------ |
| Max request body on Vercel serverless/edge functions | **4.5 MB** | Vercel platform (not configurable) |

The `quotation.save` tRPC mutation sends the entire `PageData[]` document as a
single JSON request body (`use-quotation-persistence.ts` → `saveMutation.mutate`).
Everything in the document counts toward this one number: pages, elements,
text, table cells, styles, **and image data URLs**.

**When exceeded:** the platform rejects the request with **HTTP 413** before any
app code runs. The tRPC client then tries to `JSON.parse` the non-JSON 413
response and throws a second, confusing error like **`Unexpected token 'R'`**
(the `R` of "Request Entity Too Large"). One cause, two visible errors.

base64 note: images are stored as base64 data URLs, which inflate the raw file
size by ~**33%**. A 3 MB photo becomes ~4 MB of `src` text.

### The same trap on upload

If images are ever uploaded by POSTing the file **through** a Vercel function,
that upload request hits the **same 4.5 MB body limit**. Direct-to-storage
(signed upload URL) avoids it.

---

## 2. Per-field caps enforced by the save schema

Enforced at the save trust boundary in
`src/app/editor/_components/quotation-schema.ts`. These run **only if the body
first fits under 4.5 MB** — the platform limit is checked first.

| Field | Cap | Notes |
| ----- | --- | ----- |
| Pages per document | **500** | `quotationDocumentSchema … .max(500)` |
| Elements per page | **1,000** | `pageDataSchema.elements … .max(1_000)` |
| Element `text` length | **20,000 chars** (~20 KB) | `templateElementSchema.text.max(20_000)` |
| Image `src` length | **5,000,000 chars** (~5 MB) | `src.max(5_000_000)` — **note: a single 5 MB src already exceeds the 4.5 MB body limit on its own** |
| `id` length | 200 chars | per element and per page |
| `fill`, `headerFill`, `headerColor`, `borderColor` (styles) | 64 chars each | color strings |
| `fontFamily` | 200 chars | |
| Table columns (`colWidths`) | **100** | `tableDataSchema.colWidths.max(100)` |
| Table rows (`cells`) | **1,000** | `tableDataSchema.cells.max(1_000)` |
| Table cell text | **10,000 chars** each | inner `z.string().max(10_000)` |

**Important gap:** each field is individually capped, but **nothing caps the
_total_ document size** (other than the 4.5 MB platform body limit). The caps
multiply (see §4).

### Image `src` allowlist (not a size limit, but a save blocker)

`isAllowedImageSrc` only accepts: empty string, `data:image/...` URLs, and
same-origin paths (`/...`). Any other `src` (e.g. an external `https://host`
URL) **fails validation** and blocks the save. Relevant if you move images to
object storage — the bucket host must be allowlisted or proxied same-origin.

---

## 3. Where a single page / element can break things

A page itself has no byte cap — only element-count (1,000) and the whole-body
limit. So one page can break a save if its elements are collectively huge:

- **Long text:** one text element = up to ~20 KB. ~235 maxed text elements
  (spread across any pages) ≈ 4.5 MB _(estimate)_. Allowed by the schema
  (1,000 elements/page), so reachable with deliberate stuffing.
- **One big image on an otherwise small quotation:** a single high-res photo
  can be 4–8 MB as base64 and break the body limit **by itself** — page/element
  count is irrelevant.
- **Styles:** per-element style fields (fill, fontWeight, italic, underline,
  fontFamily, lineHeight) add only ~tens of bytes each. Styles are **not** a
  realistic size risk on their own.
- **Tables:** the single largest multiplier — see §4.

---

## 4. The theoretical worst cases (schema-allowed, body-rejected)

These are allowed by the per-field caps but would be rejected by the 4.5 MB
body limit. They show where the caps _don't_ protect you.

| Scenario | Rough max size | vs 4.5 MB |
| -------- | -------------- | --------- |
| One fully-maxed table: 1,000 rows × 20 cols × 10,000 chars | ~200,000,000 chars ≈ **200 MB** | ~40× over |
| One fully-maxed table: 1,000 rows × 100 cols × 10,000 chars | ~1,000,000,000 chars ≈ **1 GB** | ~220× over |
| 235 text elements × 20,000 chars | ~4.7 MB | ~1× (right at the edge) |
| 500 pages × 1,000 elements, each tiny (~200 B JSON) | ~100 MB | ~22× over |

Takeaway: **tables are the biggest latent risk** after images, because row ×
col × cell-length compounds fast. A single abusive table can exceed the body
limit many times over while passing every per-field cap.

---

## 5. What a _normal_ quotation actually weighs

| Content | Approx serialized size _(estimate)_ | % of 4.5 MB |
| ------- | ----------------------------------- | ----------- |
| One typical product page (name, reference, description, small inventory table) | 1–5 KB | ~0.02–0.1% |
| 20-page quotation (no images) | 20–100 KB | ~0.4–2% |
| 100-page quotation (no images) | 100–500 KB | ~2–11% |
| Pages needed to reach 4.5 MB from normal content alone | **~1,000–4,000 pages** | 100% |
| One high-res photo as base64 | 1–8 MB | ~22–180% |

**Conclusion:** with images out of the body, normal editing cannot realistically
hit the limit. With full-resolution images in the body, **one or two can.**

---

## 6. Downstream limits (beyond the save body)

- **PostgreSQL JSONB column** (`quotations.data`, `src/server/db/schema.ts`):
  a single field value can be up to ~**1 GB** (and rows are TOAST-compressed).
  Not a practical limit — the 4.5 MB body limit is hit first by ~220×. But
  large base64 in JSONB does bloat row size, slowing `byId` / `list` reads.
- **SuperJSON + httpBatchStreamLink** (`src/trpc/react.tsx`): requests are
  batched and serialized with SuperJSON. Batching means multiple calls can
  share one HTTP body — in theory adding to the 4.5 MB total — though `save` is
  the only large payload in practice.
- **Browser memory / canvas:** very large images or hundreds of pages can
  degrade Konva canvas performance and memory well before any save limit; this
  is a UX limit, not a hard cap.
- **PDF export** (`pdf-export.ts`): builds the PDF client-side and fetches
  images; large/many images increase memory and export time, independent of
  the save body limit.

---

## 7. Mitigations (reference)

Ordered by how completely they remove the risk:

1. **Store images in object storage, keep only the URL in `src`.** Removes all
   image bytes from the body → the 413 becomes structurally impossible
   regardless of image count/size, and preserves original image quality.
   Requires: a bucket, a secure (direct) upload path, allowlisting/proxying the
   bucket host in `isAllowedImageSrc`, and orphan cleanup.
2. **Downscale/compress images on upload** (client-side). Shrinks each image
   5–20×; fast and infra-free, but **lossy** (quality loss) and only buys
   headroom — a single huge source or many images can still break it.
3. **Total-document-size guard.** On `save` (input or `handleSave`), reject/warn
   if the serialized payload exceeds a safe threshold (e.g. ~3–4 MB). Closes the
   theoretical table/text abuse cases §4 that per-field caps miss, and turns a
   cryptic 413/parse error into a clear message. Complementary to 1 or 2.
4. **Align the per-image `src` cap** (currently 5 MB) with reality — if images
   stay in the body, a cap below the body limit (accounting for base64 + other
   content) would fail fast with a clear message instead of a 413.

---

## 8. Quick-reference cheat sheet

| Limit | Value | Enforced by | Breaks how |
| ----- | ----- | ----------- | ---------- |
| Request body | 4.5 MB | Vercel platform | 413 + tRPC parse error |
| Pages/document | 500 | Zod schema | validation error |
| Elements/page | 1,000 | Zod schema | validation error |
| Text/element | 20,000 chars | Zod schema | validation error |
| Image `src` | 5 MB | Zod schema | validation error (but body limit usually hits first) |
| Table cols | 100 | Zod schema | validation error |
| Table rows | 1,000 | Zod schema | validation error |
| Table cell | 10,000 chars | Zod schema | validation error |
| Total document size | — | **nothing** (only the body limit) | silent until 413 |
