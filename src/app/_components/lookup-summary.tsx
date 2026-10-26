"use client";

import { t } from "@/i18n/messages";
import { setPendingQuotationClient } from "@/lib/quotation-load";
import {
  clearQuotationProducts,
  addQuotationProduct,
  type QuotationProduct,
} from "@/lib/quotation-selection";
import type { ResolveResult } from "@/server/external/resolve";
import { useRouter } from "next/navigation";
import type { FC } from "react";

interface LookupSummaryProps {
  data: ResolveResult | undefined;
  clientId: string | null;
  contactId: string | null;
  submitted: string[];
}

export const LookupSummary: FC<LookupSummaryProps> = ({
  data,
  clientId,
  contactId,
  submitted,
}) => {
  const router = useRouter();

  const handleLoad = () => {
    const resolved = data?.resolved ?? [];
    if (resolved.length === 0 || !clientId) return;
    // Replace any prior selection with this resolved set, then hand off to
    // the editor (which reads sessionStorage on mount).
    clearQuotationProducts();
    for (const product of resolved) {
      addQuotationProduct(product);
    }
    setPendingQuotationClient(clientId, contactId);
    router.push("/editor");
  };

  const resolved = data?.resolved ?? [];
  const unresolved = data?.unresolved ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">
          {t("lookup.resultCount", {
            resolved: resolved.length,
            submitted: submitted.length,
          })}
        </h2>
        <button
          type="button"
          onClick={handleLoad}
          disabled={resolved.length === 0 || !clientId}
          className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {t("lookup.load")}
        </button>
      </div>

      {resolved.length > 0 && <ResolvedSummary resolved={resolved} />}
      {unresolved.length > 0 && <UnresolvedSummary unresolved={unresolved} />}
    </section>
  );
};

function ResolvedSummary({ resolved }: { resolved: QuotationProduct[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {resolved.map((product) => (
        <li
          key={product.id}
          className="flex flex-col items-start justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:gap-4"
        >
          <div className="flex flex-col gap-1">
            <span className="flex items-start gap-2">
              <span className="flex-none rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600">
                {product.reference}
              </span>
              <span className="font-semibold break-words text-neutral-900">
                {product.name}
              </span>
            </span>
            {product.variants.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {product.variants.map((variant) => (
                  <span
                    key={variant.id}
                    className="flex items-center gap-1 rounded-full bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600"
                    title={t("lookup.stockTitle", {
                      color: variant.colorName,
                      count: variant.stock,
                    })}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-neutral-300"
                      style={{ backgroundColor: variant.colorHex }}
                      aria-hidden="true"
                    />
                    {variant.colorName} ({variant.stock})
                  </span>
                ))}
              </span>
            )}
          </div>
          <span className="text-primary shrink-0 self-end font-semibold sm:self-auto">
            {product.price}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UnresolvedSummary({ unresolved }: { unresolved: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-amber-700 uppercase">
        {t("lookup.notFound", { count: unresolved.length })}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {unresolved.map((ref) => (
          <span
            key={ref}
            className="rounded-full bg-white px-2 py-0.5 font-mono text-xs text-amber-800"
          >
            {ref}
          </span>
        ))}
      </span>
    </div>
  );
}
