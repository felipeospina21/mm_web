"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n/messages";
import { MAX_REFERENCES, parseReferences } from "@/lib/references";
import { api, type RouterOutputs } from "@/trpc/react";

export type ResolvedProductList =
  RouterOutputs["product"]["resolveReferences"]["resolved"];

export interface AddProductModalProps {
  open?: boolean;
  onClose: () => void;
  onAddProducts: (products: ResolvedProductList) => void;
}

function useProductLookup() {
  const [productReferenceInput, setProductReferenceInput] = useState("");
  const [submittedProductReferences, setSubmittedProductReferences] = useState<
    string[]
  >([]);

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

  const handleResolve = useCallback(() => {
    setSubmittedProductReferences(parsedProductReferences);
  }, [parsedProductReferences]);

  const reset = useCallback(() => {
    setProductReferenceInput("");
    setSubmittedProductReferences([]);
  }, []);

  return {
    productReferenceInput,
    setProductReferenceInput,
    submittedProductReferences,
    productLookup,
    parsedProductReferences,
    hasCurrentProductResults,
    handleResolve,
    reset,
  };
}

export function AddProductModal({
  open = true,
  onClose,
  onAddProducts,
}: AddProductModalProps) {
  const {
    productReferenceInput,
    setProductReferenceInput,
    submittedProductReferences,
    productLookup,
    parsedProductReferences,
    hasCurrentProductResults,
    handleResolve,
    reset,
  } = useProductLookup();

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleLoad = useCallback(() => {
    const resolved = productLookup.data?.resolved;
    if (resolved && resolved.length > 0) {
      onAddProducts(resolved);
      handleClose();
    }
  }, [productLookup.data, onAddProducts, handleClose]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
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
          ref={textareaRef}
          value={productReferenceInput}
          onChange={(event) => setProductReferenceInput(event.target.value)}
          rows={3}
          placeholder={t("lookup.placeholder")}
          className="focus:border-primary w-full resize-y rounded-lg border border-neutral-300 p-3 text-sm outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-500">
            {hasCurrentProductResults &&
              productLookup.data &&
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
            onClick={handleResolve}
            className="bg-primary rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {productLookup.isFetching
              ? t("lookup.resolving")
              : t("lookup.resolve")}
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={
              !hasCurrentProductResults || !productLookup.data?.resolved.length
            }
            onClick={handleLoad}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("lookup.load")}
          </button>
        </div>
      </section>
    </div>
  );
}
