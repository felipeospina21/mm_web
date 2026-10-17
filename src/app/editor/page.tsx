"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { exportPagesToPdf } from "./_components/pdf-export";
import {
  buildPagesFromQuotation,
  buildProductPage,
  ensurePageLogos,
  makeEmptyProductPage,
  makeEmptyQuotationPages,
  DUMMY_QUOTATION,
} from "./_components/template-data";
import type {
  PageData,
  Product,
  QuotationData,
  TemplateElement,
} from "./_components/types";
import { ActionsMenu } from "./_components/actions-menu";
import {
  getQuotationProducts,
  type QuotationProduct,
} from "@/lib/quotation-selection";
import {
  takePendingQuotationClient,
  takePendingManualQuotation,
  takePendingQuotationLoad,
  clearPendingQuotationLoad,
} from "@/lib/quotation-load";
import { ConfirmModal } from "@/app/_components/confirm-modal";
import { AddProductModal } from "./_components/add-product-modal";
import { api, type RouterOutputs } from "@/trpc/react";
import { t } from "@/i18n/messages";
import { theme } from "@/lib/theme";
import { formatQuotationFooter } from "@/lib/company-profile";

// Konva touches `window` at import time, so the canvas is loaded
// client-side only.
const QuotationCanvas = dynamic(
  () => import("./_components/quotation-canvas"),
  { ssr: false },
);

type QuotationRow = NonNullable<RouterOutputs["quotation"]["byId"]>;

export default function EditorPage() {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Unsaved-changes flag: true after any edit, cleared on successful save.
  const [isDirty, setIsDirty] = useState(false);
  const editRevisionRef = useRef(0);
  const saveRevisionRef = useRef(0);
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const activePageNumberRef = useRef(1);

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
   * products picked on the home page). An empty start keeps the same blank
   * product page used by the Add Page action.
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
  const [pages, setPages] = useState<PageData[]>(makeInitialPages);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    takePendingQuotationClient(),
  );
  const pagesRef = useRef(pages);
  const replacePages = useCallback((next: PageData[]) => {
    pagesRef.current = next;
    setPages(next);
  }, []);
  const historyRef = useRef<PageData[][]>([pages]);
  const historyIndexRef = useRef(0);

  /** Push a new state snapshot onto the history stack */
  const commitHistory = useCallback((next: PageData[]) => {
    historyIndexRef.current += 1;
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current);
    historyRef.current.push(next);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const setPagesWithHistory = useCallback(
    (updater: PageData[] | ((prev: PageData[]) => PageData[])) => {
      editRevisionRef.current += 1;
      const next =
        typeof updater === "function" ? updater(pagesRef.current) : updater;
      pagesRef.current = next;
      setPages(next);
      commitHistory(next);
      setIsDirty(true);
    },
    [commitHistory],
  );

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;
    editRevisionRef.current += 1;
    pagesRef.current = snapshot;
    setPages(snapshot);
    setIsDirty(true);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;
    editRevisionRef.current += 1;
    pagesRef.current = snapshot;
    setPages(snapshot);
    setIsDirty(true);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);
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
      // Keep edits made while this request was in flight; the response only
      // contains the earlier snapshot that was submitted.
      if (editRevisionRef.current !== saveRevisionRef.current) return;
      // The server returns the saved document with the number assigned by
      // the database. Keep the canvas and its undo baseline in sync with it.
      replacePages(result.data);
      historyRef.current = [result.data];
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
  const clientsQuery = api.customer.list.useQuery();
  const canSave = Boolean(
    selectedClientId && (saved ?? hasInitialProducts ?? isDirty),
  );

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
    [setPagesWithHistory],
  );
  const handleSave = useCallback(() => {
    if (!canSave || !selectedClientId) return;
    saveRevisionRef.current = editRevisionRef.current;
    const currentPages = pagesRef.current;

    saveMutation.mutate({
      id: saved?.id,
      clientId: selectedClientId,
      data: currentPages,
    });
  }, [canSave, saveMutation, saved?.id, selectedClientId]);

  // ---- Load a saved quotation (handed off from the My Quotations page) ----

  // Pending quotation id to load, read once from sessionStorage on mount.
  const [pendingLoadId] = useState<string | null>(() =>
    takePendingQuotationLoad(),
  );
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
                    text: client.name,
                  }
                : element.id === "customer-name"
                  ? {
                      ...element,
                      text: t("template.customer", {
                        name: client.contacts[0]?.name ?? "",
                      }),
                    }
                  : element,
            ),
          },
    );
    pagesRef.current = initialPages;
    setPages(initialPages);
    historyRef.current = [initialPages];
    historyIndexRef.current = 0;
    metaRef.current = {
      ...metaRef.current,
      companyName: client.name,
      customerName: client.contacts[0]?.name ?? "",
    };
    pendingHomeClientIdRef.current = null;
  }, [clientsQuery.data, pendingLoadId, selectedClientId]);

  const loadQuery = api.quotation.byId.useQuery(
    { id: pendingLoadId ?? "" },
    { enabled: !!pendingLoadId },
  );

  // When a dirty editor would be overwritten by a load, hold the row here
  // and show the confirm modal before applying it.
  const [dismissedLoadId, setDismissedLoadId] = useState<string | null>(null);
  const confirmLoad =
    isDirty && loadQuery.data && loadQuery.data.id !== dismissedLoadId
      ? loadQuery.data
      : null;

  /** Replace the editor contents with a loaded quotation and mark it saved. */
  const hydrateFromRow = useCallback(
    (row: QuotationRow) => {
      const pagesWithLogos = ensurePageLogos(row.data).map((page) => ({
        ...page,
        elements: page.elements.map((element) =>
          element.id === "customer-name"
            ? { ...element, isDraggable: false, isEditable: false }
            : element,
        ),
      }));
      const productCount = pagesWithLogos.filter((page) =>
        page.elements.some((element) => element.id.startsWith("product-name-")),
      ).length;
      metaRef.current = {
        ...DUMMY_QUOTATION,
        products: Array.from<Product>({ length: productCount }),
      };
      setSelectedClientId(row.clientId);
      pendingHomeClientIdRef.current = null;
      replacePages(pagesWithLogos);
      // Reset history to the loaded state.
      historyRef.current = [pagesWithLogos];
      historyIndexRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      setSaved({ id: row.id, quotationNumber: row.quotationNumber });
      setIsDirty(false);
    },
    [replacePages],
  );

  // Apply the loaded quotation when clean. The dirty case is represented
  // directly by `confirmLoad`, so this effect does not mirror query state.
  const hydratedLoadIdRef = useRef<string | null>(null);
  useEffect(() => {
    const row = loadQuery.data;
    if (!row) return;
    clearPendingQuotationLoad(row.id);
    if (
      isDirty ||
      row.id === dismissedLoadId ||
      hydratedLoadIdRef.current === row.id
    ) {
      return;
    }
    hydratedLoadIdRef.current = row.id;
    hydrateFromRow(row);
  }, [loadQuery.data, isDirty, dismissedLoadId, hydrateFromRow]);

  // ---- Undo/redo history ----
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
    const representativeEmail = representative.email ?? "";
    const previousMeta = metaRef.current;
    const representativeText = [
      t("template.representative"),
      representativeName,
      representativePhone,
      representativeEmail,
    ].join("\n");

    // Read the latest page snapshot: the selected client can be applied in
    // the effect above during the same commit as this profile hydration.
    const nextPages = pagesRef.current.map((page) => ({
      ...page,
      elements: page.elements.map((element) => {
        if (element.id === "representative-info") {
          return { ...element, text: representativeText };
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
    replacePages(nextPages);
    historyRef.current = [nextPages];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [representativeQuery.data, saved, isDirty, pendingLoadId, replacePages]);

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
  }, []);

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
      const fileName = `Cotización N°${saveMutation.data?.quotationNumber} - ${saveMutation.data?.clientName} - Magic Medios SAS.pdf`;
      exportPagesToPdf(stage, pages, fileName);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert(t("editor.pdfExportFailed"));
    } finally {
      setIsExporting(false);
    }
  }, [pages, saveMutation.data]);

  return (
    // h-screen minus the 56px global navbar rendered above by the layout,
    // so the editor fills the viewport exactly without the body scrolling.
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      {/* Slim editor toolbar. The global navbar (Catalog / Editor / Sign
          out) is rendered above this by the layout, so we only keep the
          editor-specific actions here — collapsed into a dropdown. */}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-neutral-200 bg-white px-2 py-2 sm:h-12 sm:flex-nowrap sm:px-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {t("editor.title")}
          </h1>
          {/* Draft until saved; shows the DB-assigned number once persisted. */}
          {saved ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-green-800 sm:px-2.5 sm:text-xs">
              {t("editor.quotationNumber", { number: saved.quotationNumber })}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-neutral-500 sm:px-2.5 sm:text-xs">
              {t("editor.draft")}
            </span>
          )}
          {/* Unsaved-changes indicator. */}
          {isDirty && (
            <span className="hidden items-center gap-1 text-xs font-medium text-amber-600 sm:flex">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              {t("editor.unsaved")}
            </span>
          )}
        </div>
        <div className="flex w-full items-center justify-end gap-1 sm:w-auto sm:gap-2">
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
            disabled={saveMutation.isPending ?? !canSave}
            className="rounded bg-green-600 px-2 py-1.5 text-xs whitespace-nowrap text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
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
            className="bg-primary rounded px-2 py-1.5 text-xs whitespace-nowrap text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
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
          onActivePageChange={handleActivePageChange}
          onPasteImage={handlePasteImage}
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
        onConfirm={() => {
          if (confirmLoad) {
            hydratedLoadIdRef.current = confirmLoad.id;
            hydrateFromRow(confirmLoad);
            setDismissedLoadId(confirmLoad.id);
          }
        }}
        onCancel={() => {
          if (confirmLoad) setDismissedLoadId(confirmLoad.id);
        }}
      />
    </div>
  );
}
