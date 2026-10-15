"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { exportPagesToPdf } from "./_components/pdf-export";
import {
  buildPagesFromQuotation,
  ensurePageLogos,
  makeEmptyProductPage,
  makeEmptyQuotationPages,
  DUMMY_QUOTATION,
} from "./_components/template-data";
import type {
  PageData,
  QuotationData,
  TemplateElement,
} from "./_components/types";
import { ActionsMenu } from "./_components/actions-menu";
import {
  getQuotationProducts,
  type QuotationProduct,
} from "@/lib/quotation-selection";
import { takePendingQuotationLoad } from "@/lib/quotation-load";
import { ConfirmModal } from "@/app/_components/confirm-modal";
import { api } from "@/trpc/react";
import { t } from "@/i18n/messages";
import { theme } from "@/lib/theme";
import { formatQuotationFooter } from "@/lib/company-profile";
import { MAX_REFERENCES, parseReferences } from "@/lib/references";

// Konva touches `window` at import time, so the canvas is loaded
// client-side only.
const QuotationCanvas = dynamic(
  () => import("./_components/quotation-canvas"),
  { ssr: false },
);

export default function EditorPage() {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Unsaved-changes flag: true after any edit, cleared on successful save.
  const [isDirty, setIsDirty] = useState(false);
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const [productReferenceInput, setProductReferenceInput] = useState("");
  const [submittedProductReferences, setSubmittedProductReferences] =
    useState<string[]>([]);

  /** Push a new state snapshot onto the history stack */
  const commitHistory = useCallback((next: PageData[]) => {
    // Drop any redo tail, then append
    historyIndexRef.current += 1;
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current);
    historyRef.current.push(next);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const setPagesWithHistory = useCallback(
    (updater: PageData[] | ((prev: PageData[]) => PageData[])) => {
      setPages((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        commitHistory(next);
        return next;
      });
      // Any edit leaves the quotation with unsaved changes.
      setIsDirty(true);
    },
    [commitHistory],
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;
    setPages(snapshot);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;
    setPages(snapshot);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const handleStageReady = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
  }, []);

  // Warn before leaving/reloading the tab when there are unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show their own generic message; setting
      // returnValue is what actually triggers the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /**
   * Builds the initial quotation `meta` (client/company details + the
   * products picked on the home page). Falls back to the dummy header-only
   * quotation when nothing was picked.
   */
  const makeInitialMeta = useCallback((): QuotationData => {
    const picked = getQuotationProducts();
    return {
      ...DUMMY_QUOTATION,
      products: picked.map((product: QuotationProduct) => ({
        name: product.name,
        reference: product.reference,
        price: product.price,
        description: product.description,
        imageUrl: product.imageUrl ?? null,
        variants: product.variants.map((variant) => ({
          colorName: variant.colorName,
          colorHex: variant.colorHex,
          stock: variant.stock,
          packaging: variant.packaging,
        })),
      })),
    };
  }, []);

  /**
   * Builds the initial quotation pages from the products selected on
   * the home page: header page + first product, one page per additional
   * product, and the fixed policies last page. Falls back to the empty
   * quotation (header page + policies page) when nothing is picked.
   */
  const makeInitialPages = useCallback((): PageData[] => {
    const picked = getQuotationProducts();
    if (picked.length === 0) return makeEmptyQuotationPages();
    return buildPagesFromQuotation(makeInitialMeta());
  }, [makeInitialMeta]);

  // Source `meta` for the quotation (client + products). Captured at mount;
  // persisted alongside the edited pages on save.
  const metaRef = useRef<QuotationData>(makeInitialMeta());

  // Initial quotation pages: header page + policies page, plus one page
  // per product picked on the home page.
  const [pages, setPages] = useState<PageData[]>(makeInitialPages);
  const [isExporting, setIsExporting] = useState(false);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Saved identity: null while a draft, { id, quotationNumber } once persisted.
  const [saved, setSaved] = useState<{
    id: string;
    quotationNumber: number;
  } | null>(null);

  const saveMutation = api.quotation.save.useMutation({
    onSuccess: (result) => {
      setSaved(result);
      // The server returns the saved document with the number assigned by
      // the database. Keep the canvas and its undo baseline in sync with it.
      setPages(result.data.pages);
      historyRef.current = [result.data.pages];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setIsDirty(false);
    },
    onError: (error) => {
      console.error("Save failed:", error);
      alert(t("editor.saveFailed", { error: error.message }));
    },
  });

  const representativeQuery = api.quotation.representative.useQuery();
  const productLookup = api.product.resolveReferences.useQuery(
    { references: submittedProductReferences },
    { enabled: submittedProductReferences.length > 0, staleTime: 0 },
  );
  const parsedProductReferences = parseReferences(productReferenceInput);
  const hasCurrentProductResults =
    parsedProductReferences.length === submittedProductReferences.length &&
    parsedProductReferences.every(
      (reference, index) => reference === submittedProductReferences[index],
    ) &&
    submittedProductReferences.length > 0 &&
    productLookup.isSuccess;

  const handleAddProducts = useCallback(() => {
    setProductReferenceInput("");
    setSubmittedProductReferences([]);
    setIsAddProductsOpen(true);
  }, []);

  const handleAppendProducts = useCallback(() => {
    const resolved = productLookup.data?.resolved ?? [];
    const existingReferences = new Set(
      metaRef.current.products.map((product) => product.reference.toLowerCase()),
    );
    const additions = resolved.filter(
      (product) => !existingReferences.has(product.reference.toLowerCase()),
    );
    if (additions.length === 0) return;

    const addedProducts = additions.map((product) => ({
      name: product.name,
      reference: product.reference,
      price: product.price,
      description: product.description,
      imageUrl: product.imageUrl ?? null,
      variants: product.variants.map((variant) => ({
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        stock: variant.stock,
        packaging: variant.packaging,
      })),
    }));
    const existingProducts = metaRef.current.products;
    const baseProductCount = Math.max(existingProducts.length, 1);
    const filler = existingProducts[0] ?? DUMMY_QUOTATION.products[0]!;
    const generatedPages = buildPagesFromQuotation({
      ...metaRef.current,
      products: [
        ...Array.from({ length: baseProductCount }, () => filler),
        ...addedProducts,
      ],
    }).slice(baseProductCount, baseProductCount + addedProducts.length);

    metaRef.current = {
      ...metaRef.current,
      products: [...existingProducts, ...addedProducts],
    };
    setPagesWithHistory((previous) => {
      const policiesIndex = previous.findIndex((page) =>
        page.elements.some((element) => element.id === "policies-body"),
      );
      const insertAt = policiesIndex < 0 ? previous.length : policiesIndex;
      const next = [...previous];
      next.splice(insertAt, 0, ...generatedPages);
      return next.map((page, index) => ({
        ...page,
        id: `page-${index + 1}`,
        pageNumber: index + 1,
      }));
    });
    setIsAddProductsOpen(false);
    setProductReferenceInput("");
    setSubmittedProductReferences([]);
  }, [productLookup.data, setPagesWithHistory]);

  const handleSave = useCallback(() => {
    const meta = metaRef.current;

    // The client name is edited on the canvas in the first page's
    // "Cotización para:" block (element id `client-info`), which reads
    // "Cotización para:\n<name>\n<address>\n<email>". Take the name line.
    const clientInfo = pages[0]?.elements.find((el) => el.id === "client-info");
    const nameLine = clientInfo?.text.split("\n")[1]?.trim();
    const metaName = metaRef.current.customerName.trim();
    const clientName =
      nameLine && nameLine.length > 0
        ? nameLine
        : metaName.length > 0
          ? metaName
          : t("editor.untitledClient");

    saveMutation.mutate({
      id: saved?.id,
      clientName,
      // Snapshot of the product reference codes in this quotation.
      references: meta.products.map((p) => p.reference),
      data: { meta, pages },
    });
  }, [saveMutation, saved?.id, pages]);

  // ---- Load a saved quotation (handed off from the My Quotations page) ----

  // Pending quotation id to load, read once from sessionStorage on mount.
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);
  useEffect(() => {
    setPendingLoadId(takePendingQuotationLoad());
  }, []);

  const loadQuery = api.quotation.byId.useQuery(
    { id: pendingLoadId ?? "" },
    { enabled: !!pendingLoadId },
  );

  // When a dirty editor would be overwritten by a load, hold the row here
  // and show the confirm modal before applying it.
  const [confirmLoad, setConfirmLoad] = useState<NonNullable<
    typeof loadQuery.data
  > | null>(null);

  /** Replace the editor contents with a loaded quotation and mark it saved. */
  const hydrateFromRow = useCallback(
    (row: NonNullable<typeof loadQuery.data>) => {
      const doc = row.data;
      const pagesWithLogos = ensurePageLogos(doc.pages);
      metaRef.current = doc.meta;
      setPages(pagesWithLogos);
      // Reset history to the loaded state.
      historyRef.current = [pagesWithLogos];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setSaved({ id: row.id, quotationNumber: row.quotationNumber });
      setIsDirty(false);
    },
    [],
  );

  // Apply the loaded quotation: hydrate immediately when the editor has no
  // unsaved work; otherwise defer to the confirm modal.
  useEffect(() => {
    const row = loadQuery.data;
    if (!row) return;
    if (isDirty) {
      setConfirmLoad(row);
    } else {
      hydrateFromRow(row);
    }
    // Consume the pending id so the query doesn't re-trigger.
    setPendingLoadId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadQuery.data]);

  // ---- Undo/redo history ----
  const historyRef = useRef<PageData[][]>([makeInitialPages()]);
  const historyIndexRef = useRef(0);
  const representativeAppliedRef = useRef(false);

  // Populate a new draft from the signed-in user's database profile. Saved
  // quotations keep their own metadata snapshot when reopened.
  useEffect(() => {
    const representative = representativeQuery.data;
    if (
      !representative ||
      representativeAppliedRef.current ||
      saved ||
      isDirty ||
      pendingLoadId
    ) {
      return;
    }
    representativeAppliedRef.current = true;

    const representativeName = representative.name ?? "";
    const representativePhone = representative.phone ?? "";
    const representativePhoneExtension =
      representative.phoneExt == null ? "" : String(representative.phoneExt);
    const representativeCellphone = representative.cellphone ?? "";
    const representativeEmail = representative.email;
    const previousMeta = metaRef.current;

    const interpolateRepresentative = (text: string) => {
      let result = text
        .replaceAll("{{representativeName}}", representativeName)
        .replaceAll("{{representativePhone}}", representativePhone)
        .replaceAll("{{representativeEmail}}", representativeEmail)
        .replaceAll("{{representative.name}}", representativeName)
        .replaceAll("{{representative.phone}}", representativePhone)
        .replaceAll("{{representative.email}}", representativeEmail);

      if (previousMeta.representativeName) {
        result = result.replaceAll(
          previousMeta.representativeName,
          representativeName,
        );
      }
      if (previousMeta.representativePhone) {
        result = result.replaceAll(
          previousMeta.representativePhone,
          representativePhone,
        );
      }
      if (previousMeta.representativeEmail) {
        result = result.replaceAll(
          previousMeta.representativeEmail,
          representativeEmail,
        );
      }
      return result;
    };

    const nextPages = pages.map((page) => ({
      ...page,
      elements: page.elements.map((element) => {
        if (element.id === "representative-info") {
          return { ...element, text: interpolateRepresentative(element.text) };
        }
        if (element.id === "footer") {
          return {
            ...element,
            text: formatQuotationFooter({
              representativeCellphone,
              representativePhone,
              representativePhoneExtension,
              representativeEmail,
            }),
          };
        }
        return element;
      }),
    }));
    metaRef.current = {
      ...previousMeta,
      representativeName,
      representativePhone,
      representativePhoneExtension,
      representativeCellphone,
      representativeEmail,
    };
    setPages(nextPages);
    historyRef.current = [nextPages];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [representativeQuery.data, saved, isDirty, pendingLoadId, pages]);

  /** Persist any element edit (drag, resize, text, formatting) */
  const handleElementChange = useCallback(
    (pageId: string, elementId: string, patch: Partial<TemplateElement>) => {
      setPagesWithHistory((prev) =>
        prev.map((page, pageIndex) => {
          if (page.id !== pageId) return page;
          let elementPatch = patch;
          if (
            elementId.startsWith("product-name-") &&
            typeof patch.text === "string"
          ) {
            const productNumber = prev
              .slice(0, pageIndex + 1)
              .filter((candidate) =>
                candidate.elements.some((element) =>
                  element.id.startsWith("product-name-"),
                ),
              ).length;
            const name = patch.text.replace(/^\d+\.\s*/, "").trim();
            elementPatch = {
              ...patch,
              text: name ? `${productNumber}. ${name}` : "",
            };
          }
          return {
            ...page,
            elements: page.elements.map((el) =>
              el.id === elementId ? { ...el, ...elementPatch } : el,
            ),
          };
        }),
      );
    },
    [setPagesWithHistory],
  );

  /** Insert a blank product page immediately before the final policies page. */
  const handleAddPage = useCallback(() => {
    setPagesWithHistory((prev) => {
      const policiesIndex = prev.findIndex((page) =>
        page.elements.some((element) => element.id === "policies-body"),
      );
      const insertAt =
        policiesIndex < 0 ? Math.max(prev.length - 1, 0) : policiesIndex;
      const pageNumber = insertAt + 1;
      const newPage = makeEmptyProductPage(pageNumber, metaRef.current);
      const next = [...prev];
      next.splice(insertAt, 0, newPage);
      return next.map((page, index) => ({
        ...page,
        id: `page-${index + 1}`,
        pageNumber: index + 1,
      }));
    });
  }, [setPagesWithHistory]);

  /** Delete the selected element */
  const handleDeleteElement = useCallback(
    (elementId: string) => {
      if (
        !pages.some((page) =>
          page.elements.some(
            (element) =>
              element.id === elementId &&
              (element.isDeletable ?? element.isEditable ?? false),
          ),
        )
      ) {
        return;
      }
      setPagesWithHistory((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.filter((el) => el.id !== elementId),
        })),
      );
    },
    [pages, setPagesWithHistory],
  );

  /** Duplicate the selected element, offset slightly below the original */
  const handleDuplicateElement = useCallback(
    (elementId: string) => {
      if (
        !pages.some((page) =>
          page.elements.some(
            (element) => element.id === elementId && element.isEditable,
          ),
        )
      ) {
        return;
      }
      setPagesWithHistory((prev) =>
        prev.map((page) => {
          const source = page.elements.find((el) => el.id === elementId);
          if (!source) return page;
          const copy: TemplateElement = {
            ...source,
            id: `${source.id}-copy-${Date.now()}`,
            y: source.y + 30,
          };
          return { ...page, elements: [...page.elements, copy] };
        }),
      );
    },
    [pages, setPagesWithHistory],
  );

  /** Add a new element to the first page */
  const handleAddElement = useCallback(
    (type: "text" | "rect" | "table" | "image") => {
      const newId = `el-${type}-${Date.now()}`;
      const base = {
        id: newId,
        x: 100,
        y: 600,
        width: type === "rect" ? 200 : 300,
        height: type === "rect" ? 100 : 40,
        text: type === "text" ? t("editor.newText") : "",
        fontSize: 16,
        fill: type === "rect" ? theme.colors.primary : theme.colors.secondary,
        isDraggable: true,
        isEditable: true,
      };
      const element: TemplateElement =
        type === "table"
          ? {
              ...base,
              type: "table",
              width: 400,
              height: 120,
              table: {
                colWidths: [100, 100, 100, 100],
                rowHeight: 30,
                cells: [
                  ["A", "B", "C", "D"],
                  ["", "", "", ""],
                  ["", "", "", ""],
                ],
                headerFill: theme.colors.primary,
                headerColor: "#ffffff",
                borderColor: "#cccccc",
                fontSize: 12,
              },
            }
          : type === "image"
            ? { ...base, type: "image", src: "" }
            : { ...base, type };

      setPagesWithHistory((prev) =>
        prev.map((page, index) =>
          index === 0
            ? { ...page, elements: [...page.elements, element] }
            : page,
        ),
      );
    },
    [setPagesWithHistory],
  );

  // Track the selected element id via a ref (set by the canvas)
  const selectedIdRef = useRef<string | null>(null);
  const handleSelectionChange = useCallback((id: string | null) => {
    selectedIdRef.current = id;
  }, []);

  // Keyboard shortcuts: undo/redo, delete, duplicate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Only delete when not typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (selectedIdRef.current) {
          e.preventDefault();
          handleDeleteElement(selectedIdRef.current);
        }
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedIdRef.current) {
          handleDuplicateElement(selectedIdRef.current);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo, handleDeleteElement, handleDuplicateElement]);

  const handleExportPdf = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setIsExporting(true);
    // Let the button state render before the (synchronous) capture work
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      exportPagesToPdf(stage, pages, "cotizacion.pdf");
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(t("editor.pdfExportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [pages]);

  return (
    // h-screen minus the 56px global navbar rendered above by the layout,
    // so the editor fills the viewport exactly without the body scrolling.
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Slim editor toolbar. The global navbar (Catalog / Editor / Sign
          out) is rendered above this by the layout, so we only keep the
          editor-specific actions here — collapsed into a dropdown. */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">{t("editor.title")}</h1>
          {/* Draft until saved; shows the DB-assigned number once persisted. */}
          {saved ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {t("editor.quotationNumber", { number: saved.quotationNumber })}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-500">
              {t("editor.draft")}
            </span>
          )}
          {/* Unsaved-changes indicator. */}
          {isDirty && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              {t("editor.unsaved")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ActionsMenu
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAddElement={handleAddElement}
            onAddPage={handleAddPage}
            onAddProducts={handleAddProducts}
          />
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending
              ? t("editor.saving")
              : saved
                ? t("editor.save")
                : t("editor.saveQuotation")}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!saved || isExporting}
            className="rounded bg-[var(--brand-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? t("editor.exporting") : t("editor.exportPdf")}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <QuotationCanvas
          pages={pages}
          onElementChange={handleElementChange}
          onStageReady={handleStageReady}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      {isAddProductsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-products-title"
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="add-products-title" className="mb-2 text-lg font-semibold">
              {t("actions.addProducts")}
            </h2>
            <p className="mb-4 text-sm text-neutral-600">
              {t("lookup.instructions")}
            </p>
            <textarea
              value={productReferenceInput}
              onChange={(event) => setProductReferenceInput(event.target.value)}
              rows={3}
              placeholder={t("lookup.placeholder")}
              className="w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">
                {hasCurrentProductResults && productLookup.data &&
                  t("lookup.resultCount", {
                    resolved: productLookup.data.resolved.length,
                    submitted: submittedProductReferences.length,
                  })}
                {productLookup.isError && (
                  <span className="text-red-600">
                    {t("lookup.failed", { error: productLookup.error.message })}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={
                  parsedProductReferences.length === 0 ||
                  parsedProductReferences.length > MAX_REFERENCES ||
                  productLookup.isFetching
                }
                onClick={() =>
                  setSubmittedProductReferences(parsedProductReferences)
                }
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {productLookup.isFetching
                  ? t("lookup.resolving")
                  : t("lookup.resolve")}
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddProductsOpen(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={
                  !hasCurrentProductResults ||
                  !productLookup.data?.resolved.length
                }
                onClick={handleAppendProducts}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("lookup.load")}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Guard: loading a saved quotation would discard unsaved changes. */}
      <ConfirmModal
        open={confirmLoad !== null}
        title={t("editor.discardTitle")}
        message={t("editor.discardMessage")}
        confirmLabel={t("editor.discardAndLoad")}
        cancelLabel={t("editor.keepEditing")}
        onConfirm={() => {
          if (confirmLoad) hydrateFromRow(confirmLoad);
          setConfirmLoad(null);
        }}
        onCancel={() => setConfirmLoad(null)}
      />
    </div>
  );
}
