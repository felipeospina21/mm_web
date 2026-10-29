"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportPagesToPdf } from "./_lib/pdf-export";
import { useEditorKeyboardShortcuts } from "./_hooks/use-editor-keyboard-shortcuts";
import { useQuotationHistory } from "./_hooks/use-quotation-history";
import { useQuotationPersistence } from "./_hooks/use-quotation-persistence";
import { useQuotationLoad } from "./_hooks/use-quotation-load";
import {
  buildPagesFromQuotation,
  buildProductPage,
  ensurePageLogos,
  makeEmptyProductPage,
  makeEmptyQuotationPages,
} from "./_lib/template-data";
import type {
  PageData,
  Product,
  QuotationData,
  TemplateElement,
} from "./_components/types";
import { EditorToolbar } from "./_components/editor-toolbar";
import {
  getQuotationProducts,
  type QuotationProduct,
} from "@/lib/quotation-selection";
import {
  takePendingQuotationClient,
  takePendingQuotationContact,
  takePendingManualQuotation,
  takePendingQuotationLoad,
} from "@/lib/quotation-load";
import { ConfirmModal } from "@/app/_components/confirm-modal";
import { useEditorDraft } from "@/app/_components/editor-draft-context";
import { AddProductModal } from "./_components/add-product-modal";
import { capitalizeLabeledName, capitalizeName } from "@/lib/capitalize-name";
import { api, type RouterOutputs } from "@/trpc/react";
import { t } from "@/i18n/messages";
import { theme } from "@/lib/theme";
import { useRepresentativeProfile } from "./_hooks/use-representative-profile";
import { getFileName } from "@/lib/quotation-save";

// Konva touches `window` at import time, so the canvas is loaded
// client-side only.
const QuotationCanvas = dynamic(
  () => import("./_components/quotation-canvas"),
  { ssr: false },
);

type QuotationRow = NonNullable<RouterOutputs["quotation"]["byId"]>;

export default function EditorPage() {
  // Unsaved-changes flag: true after any edit, cleared on successful save.
  const [isDirty, setIsDirty] = useState(false);
  const editRevisionRef = useRef(0);
  const saveRevisionRef = useRef(0);
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const activePageNumberRef = useRef(1);
  const [activePageNumber, setActivePageNumber] = useState(1);

  /**
   * Builds the initial quotation `meta` (client/company details + the
   * products picked on the home page). An empty start keeps the same blank
   * product page used by the Add Page action.
   */
  const makeInitialMeta = useCallback((): QuotationData => {
    const picked = getQuotationProducts();
    return {
      companyName: "",
      customerName: "",
      representativeName: "",
      representativePhone: "",
      representativePhoneExtension: "",
      representativeCellphone: "",
      representativeEmail: "",
      products: picked.map((product: QuotationProduct) => ({
        name: product.name,
        reference: product.reference,
        price: product.price,
        description: product.description,
        categories: product.categories,
        imageUrl: product.imageUrl ?? null,
        variants: product.variants.map((variant) => ({
          colorName: variant.colorName,
          colorHex: variant.colorHex,
          localInventory: variant.localInventory,
          zoneInventory: variant.zoneInventory,
          stock: variant.stock,
          packaging: variant.packaging,
        })),
      })),
    };
  }, []);

  // The home-page manual-start action requests blank item fields on page one.
  // A direct editor visit or a product lookup starts with header + policies.
  const [isManualStart] = useState(() => takePendingManualQuotation());

  /**
   * Builds the initial quotation pages from the products selected on
   * the home page: header page + product pages + fixed policies last page.
   * Manual start puts blank item fields on page one; an untouched editor
   * draft keeps only the header and policies pages.
   */
  const makeInitialPages = useCallback((): PageData[] => {
    const picked = getQuotationProducts();
    if (picked.length === 0) {
      return makeEmptyQuotationPages(undefined, isManualStart);
    }
    return buildPagesFromQuotation(makeInitialMeta());
  }, [isManualStart, makeInitialMeta]);

  // Source `meta` for the quotation (client + products). Captured at mount;
  // persisted alongside the edited pages on save.
  const metaRef = useRef<QuotationData>(makeInitialMeta());

  // Product storage distinguishes loaded quotations from empty drafts.
  const [hasInitialProducts] = useState(
    () => getQuotationProducts().length > 0,
  );
  // Start null so the server render and the first client render agree (reading
  // sessionStorage in the initializer would diverge: null on the server, the
  // stored value on the client, which mismatches the Save button's disabled
  // state during hydration). The pending draft client is read after mount.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  useEffect(() => {
    const pendingClient = takePendingQuotationClient();
    if (pendingClient) setSelectedClientId(pendingClient);
  }, []);
  const pendingHomeContactIdRef = useRef(takePendingQuotationContact());

  // `pages` state + undo/redo history live in a dedicated hook; dirty/save-race
  // bookkeeping stays here via the onEdit seam.
  const onHistoryEdit = useCallback(() => {
    editRevisionRef.current += 1;
    setIsDirty(true);
  }, []);
  const {
    pages,
    pagesRef,
    canUndo,
    canRedo,
    setPagesWithHistory,
    replacePages,
    resetHistory,
    undo: handleUndo,
    redo: handleRedo,
  } = useQuotationHistory({
    initialPages: makeInitialPages,
    onEdit: onHistoryEdit,
  });

  const [isExporting, setIsExporting] = useState(false);

  // Persistence: saved identity + the save mutation + the save action.
  const {
    saved,
    setSaved,
    savedData,
    isSaving,
    canSave,
    handleSave,
  } = useQuotationPersistence({
    selectedClientId,
    pagesRef,
    editRevisionRef,
    saveRevisionRef,
    canSaveWhen: isManualStart || hasInitialProducts || isDirty,
    replacePages,
    resetHistory,
    setIsDirty,
  });

  /**
   * A draft is any editor state with content that is not persisted — so it is
   * worth protecting from an accidental refresh / navigation away:
   *   - never saved yet AND it has content (products loaded via "cargar en el
   *     editor", a manual start, or any edit) — covers the common case where a
   *     quotation is loaded but untouched, which `isDirty` alone misses; or
   *   - saved before but edited since.
   * A blank, untouched, never-saved editor is NOT a draft (nothing to lose), so
   * we don't nag on it. `isDirty` stays the precise "edited since baseline" flag
   * driving the unsaved badge and overwrite confirm.
   *
   * NOTE: this is an in-session guard only. When real draft persistence lands,
   * `isDraft` becomes the signal for what to autosave/restore.
   */
  const isDraft = saved
    ? isDirty
    : isManualStart || hasInitialProducts || isDirty;

  // Warn before leaving/reloading the tab while there is an unsaved draft.
  useEffect(() => {
    if (!isDraft) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show their own generic message; setting
      // returnValue is what actually triggers the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDraft]);

  // Publish the draft state so the nav bar can guard in-app navigations
  // (client route changes never fire `beforeunload`). Clear on unmount so a
  // stale draft flag doesn't block navigation after the editor is gone.
  const { setIsDraft } = useEditorDraft();
  useEffect(() => {
    setIsDraft(isDraft);
    return () => setIsDraft(false);
  }, [isDraft, setIsDraft]);

  const clientsQuery = api.customer.list.useQuery();

  const handleAddProducts = useCallback(() => {
    setIsAddProductsOpen(true);
  }, []);

  const handleAppendProducts = useCallback(
    (resolved: RouterOutputs["product"]["resolveReferences"]["resolved"]) => {
      const currentPages = pagesRef.current;
      const existingReferences = new Set(
        currentPages.flatMap((page) =>
          page.elements
            .filter((element) => element.id.startsWith("product-reference-"))
            .map((element) =>
              element.text.split(":").at(-1)?.trim().toLowerCase(),
            )
            .filter((reference): reference is string => Boolean(reference)),
        ),
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
        categories: product.categories,
        imageUrl: product.imageUrl ?? null,
        variants: product.variants.map((variant) => ({
          colorName: variant.colorName,
          colorHex: variant.colorHex,
          localInventory: variant.localInventory,
          zoneInventory: variant.zoneInventory,
          stock: variant.stock,
          packaging: variant.packaging,
        })),
      }));
      const existingProductCount = currentPages.filter((page) =>
        page.elements.some((element) => element.id.startsWith("product-name-")),
      ).length;
      const firstPage = currentPages[0];
      const representativeText = firstPage?.elements.find(
        (element) => element.id === "representative-info",
      )?.text;
      const representativeLines = representativeText?.split("\n") ?? [];
      const footerText = firstPage?.elements.find(
        (element) => element.id === "footer",
      )?.text;
      const currentMeta: QuotationData = {
        ...metaRef.current,
        representativeName:
          representativeLines[1]?.trim() ?? metaRef.current.representativeName,
        representativePhone:
          representativeLines[2]?.trim() ?? metaRef.current.representativePhone,
        representativeEmail:
          representativeLines[3]?.trim() ?? metaRef.current.representativeEmail,
      };
      const policiesIndex = currentPages.findIndex((page) =>
        page.elements.some((element) => element.id === "policies-body"),
      );
      const insertAt = policiesIndex < 0 ? currentPages.length : policiesIndex;

      const generatedPages = addedProducts.map((product, i) => {
        const pageNumber = insertAt + i + 1;
        const productNumber = existingProductCount + i + 1;
        const page = buildProductPage(
          product,
          currentMeta,
          pageNumber,
          productNumber,
        );
        return {
          ...page,
          elements: page.elements.map((element) => {
            if (element.id === "representative-info" && representativeText) {
              return { ...element, text: representativeText };
            }
            if (element.id === "footer" && footerText) {
              return { ...element, text: footerText };
            }
            return element;
          }),
        };
      });

      metaRef.current = {
        ...currentMeta,
        products: [
          ...(metaRef.current.products ?? []).filter(Boolean),
          ...addedProducts,
        ],
      };
      setPagesWithHistory((previous) => {
        const pIndex = previous.findIndex((page) =>
          page.elements.some((element) => element.id === "policies-body"),
        );
        const at = pIndex < 0 ? previous.length : pIndex;
        const next = [...previous];
        next.splice(at, 0, ...generatedPages);
        return next.map((page, index) => ({
          ...page,
          id: `page-${index + 1}`,
          pageNumber: index + 1,
        }));
      });
      activePageNumberRef.current = insertAt + 1;
      setIsAddProductsOpen(false);
    },
    [setPagesWithHistory, pagesRef],
  );

  // ---- Load a saved quotation (handed off from the My Quotations page) ----

  // Pending quotation id to load, read once from sessionStorage on mount.
  const [pendingLoadId] = useState<string | null>(() =>
    takePendingQuotationLoad(),
  );

  useRepresentativeProfile({
    isDirty,
    isSaved: Boolean(saved),
    pendingLoadId,
    pagesRef,
    metaRef,
    replacePages,
    resetHistory,
  });

  const pendingHomeClientIdRef = useRef(selectedClientId);

  useEffect(() => {
    const pendingHomeClientId = pendingHomeClientIdRef.current;
    if (!pendingHomeClientId || !clientsQuery.data) return;
    const client = clientsQuery.data.find(
      (item) => item.id === pendingHomeClientId,
    );
    if (!client) return;
    if (pendingLoadId) return;
    const initialPages = pagesRef.current.map((page, index) =>
      index !== 0
        ? page
        : {
            ...page,
            elements: page.elements.map((element) =>
              element.id === "company-name"
                ? {
                    ...element,
                    text: capitalizeName(client.name),
                  }
                : element.id === "customer-name"
                  ? {
                      ...element,
                      text: t("template.customer", {
                      name: capitalizeName(
                        client.contacts.find(
                          (contact) => contact.id === pendingHomeContactIdRef.current,
                        )?.name ?? client.contacts[0]?.name ?? "",
                      ),
                      }),
                    }
                  : element,
            ),
          },
    );
    replacePages(initialPages);
    resetHistory(initialPages);
    metaRef.current = {
      ...metaRef.current,
      companyName: capitalizeName(client.name),
      customerName: capitalizeName(
        client.contacts.find(
          (contact) => contact.id === pendingHomeContactIdRef.current,
        )?.name ?? client.contacts[0]?.name ?? "",
      ),
    };
    pendingHomeClientIdRef.current = null;
  }, [
    clientsQuery.data,
    pendingLoadId,
    selectedClientId,
    pagesRef,
    replacePages,
    resetHistory,
  ]);

  /** Replace the editor contents with a loaded quotation and mark it saved. */
  const hydrateFromRow = useCallback(
    (row: QuotationRow) => {
      const pagesWithLogos = ensurePageLogos(row.data).map((page) => ({
        ...page,
        elements: page.elements.map((element) => {
          if (element.id === "company-name") {
            return { ...element, text: capitalizeName(element.text) };
          }
          if (element.id === "customer-name") {
            return {
              ...element,
              text: capitalizeLabeledName(element.text),
              isDraggable: false,
              isEditable: false,
            };
          }
          if (element.id === "representative-info") {
            const lines = element.text.split("\n");
            if (lines[1]) lines[1] = capitalizeName(lines[1]);
            return { ...element, text: lines.join("\n") };
          }
          if (element.id.startsWith("line-items-") && element.table) {
            const cells = element.table.cells.map((rowCells, rowIndex) => {
              const next = [...rowCells];
              if (rowIndex === 0) {
                next[4] ??= t("template.subtotal");
              } else {
                const quantity = next[0]?.replace(/\D/g, "") ?? "";
                const price = next[3]?.replace(/\D/g, "") ?? "";
                next[4] =
                  quantity && price
                    ? `$ ${(Number(quantity) * Number(price)).toLocaleString("es-CO")}`
                    : "";
              }
              return next;
            });
            return {
              ...element,
              width: 680,
              table: {
                ...element.table,
                colWidths: [70, 230, 100, 140, 140],
                cells,
              },
            };
          }
          return element;
        }),
      }));
      const productCount = pagesWithLogos.filter((page) =>
        page.elements.some((element) => element.id.startsWith("product-name-")),
      ).length;
      metaRef.current = {
        companyName: "",
        customerName: "",
        representativeName: "",
        representativePhone: "",
        representativePhoneExtension: "",
        representativeCellphone: "",
        representativeEmail: "",
        products: Array.from<Product>({ length: productCount }),
      };
      setSelectedClientId(row.clientId);
      pendingHomeClientIdRef.current = null;
      replacePages(pagesWithLogos);
      // Reset history to the loaded state.
      resetHistory(pagesWithLogos);
      setSaved({ id: row.id, quotationNumber: row.quotationNumber });
      setIsDirty(false);
    },
    [replacePages, resetHistory, setSaved],
  );

  // Load orchestration (query, auto-apply when clean, confirm-on-dirty).
  const { confirmLoad, acceptConfirmLoad, dismissConfirmLoad } =
    useQuotationLoad({ pendingLoadId, isDirty, hydrateFromRow });

  // ---- Undo/redo history ----

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
      const footerText = prev[0]?.elements.find(
        (element) => element.id === "footer",
      )?.text;
      const pageWithCurrentFooter = footerText
        ? {
            ...newPage,
            elements: newPage.elements.map((element) =>
              element.id === "footer"
                ? { ...element, text: footerText }
                : element,
            ),
          }
        : newPage;
      const next = [...prev];
      next.splice(insertAt, 0, pageWithCurrentFooter);
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

  /** Add a new element to the page currently being edited. */
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
          index === activePageNumberRef.current - 1
            ? { ...page, elements: [...page.elements, element] }
            : page,
        ),
      );
    },
    [setPagesWithHistory],
  );

  const handleActivePageChange = useCallback((pageNumber: number) => {
    activePageNumberRef.current = pageNumber;
    setActivePageNumber(pageNumber);
  }, []);

  const handleDeletePage = useCallback(
    (pageNumber: number) => {
      setPagesWithHistory((prev) => {
        if (prev.length <= 2) return prev;
        const pageToDelete = prev.find(
          (page) => page.pageNumber === pageNumber,
        );
        if (
          !pageToDelete ||
          pageToDelete.elements.some(
            (element) => element.id === "policies-body",
          )
        ) {
          return prev;
        }
        const next = prev
          .filter((page) => page.pageNumber !== pageNumber)
          .map((page, index) => ({
            ...page,
            id: `page-${index + 1}`,
            pageNumber: index + 1,
          }));
        const nextActivePage = Math.min(pageNumber, next.length - 1);
        activePageNumberRef.current = nextActivePage;
        setActivePageNumber(nextActivePage);
        return next;
      });
    },
    [setPagesWithHistory],
  );

  const handlePasteImage = useCallback(
    (
      src: string,
      pageNumber: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const element: TemplateElement = {
        id: `el-image-${Date.now()}`,
        type: "image",
        x,
        y,
        width,
        height,
        text: "",
        fontSize: 16,
        fill: theme.colors.secondary,
        isDraggable: true,
        isEditable: true,
        src,
      };
      setPagesWithHistory((prev) =>
        prev.map((page) =>
          page.pageNumber === pageNumber
            ? { ...page, elements: [...page.elements, element] }
            : page,
        ),
      );
    },
    [setPagesWithHistory],
  );

  const handlePasteElement = useCallback(
    (pageNumber: number, element: TemplateElement) => {
      setPagesWithHistory((prev) =>
        prev.map((page) =>
          page.pageNumber === pageNumber
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

  // Keyboard shortcuts: undo/redo, delete, duplicate (see _lib/keyboard.ts).
  useEditorKeyboardShortcuts({
    selectedIdRef,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDeleteElement: handleDeleteElement,
    onDuplicateElement: handleDuplicateElement,
  });

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    // Let the button state render before image loading and PDF generation.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      const fileName = getFileName(
        savedData?.quotationNumber,
        savedData?.clientName,
      );
      await exportPagesToPdf(pages, fileName);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(t("editor.pdfExportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [pages, savedData]);

  return (
    // h-screen minus the 56px global navbar rendered above by the layout,
    // so the editor fills the viewport exactly without the body scrolling.
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      {/* Slim editor toolbar. The global navbar (Catalog / Editor / Sign
          out) is rendered above this by the layout, so we only keep the
          editor-specific actions here — collapsed into a dropdown. */}
      <EditorToolbar
        pages={pages}
        activePageNumber={activePageNumber}
        saved={saved}
        isDirty={isDirty}
        canUndo={canUndo}
        canRedo={canRedo}
        canSave={canSave}
        isSaving={isSaving}
        isExporting={isExporting}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAddElement={handleAddElement}
        onAddPage={handleAddPage}
        onDeletePage={handleDeletePage}
        onAddProducts={handleAddProducts}
        onSave={handleSave}
        onExportPdf={handleExportPdf}
      />

      <div className="min-h-0 flex-1">
        <QuotationCanvas
          pages={pages}
          activePageNumber={activePageNumber}
          onDeletePage={handleDeletePage}
          onElementChange={handleElementChange}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onSelectionChange={handleSelectionChange}
          onActivePageChange={handleActivePageChange}
          onPasteImage={handlePasteImage}
          onPasteElement={handlePasteElement}
        />
      </div>

      <AddProductModal
        open={isAddProductsOpen}
        onClose={() => setIsAddProductsOpen(false)}
        onAddProducts={handleAppendProducts}
      />

      {/* Guard: loading a saved quotation would discard unsaved changes. */}
      <ConfirmModal
        open={confirmLoad !== null}
        title={t("editor.discardTitle")}
        message={t("editor.discardMessage")}
        confirmLabel={t("editor.discardAndLoad")}
        cancelLabel={t("editor.keepEditing")}
        onConfirm={acceptConfirmLoad}
        onCancel={dismissConfirmLoad}
      />
    </div>
  );
}
