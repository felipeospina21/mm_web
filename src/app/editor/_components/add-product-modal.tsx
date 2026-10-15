import { t } from "@/i18n/messages";
import { MAX_REFERENCES } from "@/lib/references";

interface AddProductModalProps {}

export function AddProductModal() {
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
            onClick={() =>
              setSubmittedProductReferences(parsedProductReferences)
            }
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
            onClick={() => setIsAddProductsOpen(false)}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={
              !hasCurrentProductResults || !productLookup.data?.resolved.length
            }
            onClick={handleAppendProducts}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("lookup.load")}
          </button>
        </div>
      </section>
    </div>
  );
}
