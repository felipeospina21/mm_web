"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/trpc/react";
import { MAX_REFERENCES, parseReferences } from "@/lib/references";
import { t } from "@/i18n/messages";
import {
  addQuotationProduct,
  clearQuotationProducts,
} from "@/lib/quotation-selection";
import { setPendingQuotationClient } from "@/lib/quotation-load";
import { ClientField } from "./client-field";

/**
 * Home-page reference-lookup view.
 *
 * The user pastes a comma-separated list of product references (SKUs), e.g.
 * "cp-10, au 20 4, xtron". We parse it, resolve the SKUs against the external
 * API via `product.resolveReferences`, show which resolved and which did not,
 * then load the resolved products into the quotation editor (handing them off
 * through sessionStorage, exactly like the hidden catalog does).
 */
export function ReferenceLookup() {
  const router = useRouter();
  const [input, setInput] = useState("");
  // The SKUs the user actually submitted (drives the query). Empty until the
  // first "Resolve" so nothing runs on mount.
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  // Live preview of how the current textarea parses (for the counter + the
  // disabled/over-limit state), without triggering a fetch.
  const parsed = useMemo(() => parseReferences(input), [input]);
  const overLimit = parsed.length > MAX_REFERENCES;

  const query = api.product.resolveReferences.useQuery(
    { references: submitted },
    {
      enabled: submitted.length > 0,
      // Lookups are live; don't serve a stale cache for a changed list.
      staleTime: 0,
    },
  );

  const handleResolve = () => {
    if (parsed.length === 0 || overLimit) return;
    setSubmitted(parsed);
  };

  const handleLoad = () => {
    const resolved = query.data?.resolved ?? [];
    if (resolved.length === 0 || !clientId) return;
    // Replace any prior selection with this resolved set, then hand off to
    // the editor (which reads sessionStorage on mount).
    clearQuotationProducts();
    for (const product of resolved) {
      addQuotationProduct(product);
    }
    setPendingQuotationClient(clientId);
    router.push("/editor");
  };

  const resolved = query.data?.resolved ?? [];
  const unresolved = query.data?.unresolved ?? [];
  const hasResult = submitted.length > 0 && query.isSuccess;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <ClientField
          value={clientId}
          onChange={(client) => setClientId(client?.id ?? null)}
        />
        {!clientId && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {t("client.required")}
          </p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <label
          htmlFor="references"
          className="text-sm font-semibold text-neutral-800"
        >
          {t("lookup.label")}
        </label>
        <p className="text-sm text-neutral-500">{t("lookup.instructions")}</p>
        <textarea
          id="references"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder={t("lookup.placeholder")}
          className="focus:ring-primary w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none focus:border-white focus:ring-1"
        />

        <div className="flex items-center justify-between">
          <span
            className={`text-xs ${
              overLimit ? "text-red-600" : "text-neutral-400"
            }`}
          >
            {t(parsed.length === 1 ? "lookup.countOne" : "lookup.countMany", {
              count: parsed.length,
            })}
          </span>
          <button
            type="button"
            onClick={handleResolve}
            disabled={parsed.length === 0 || overLimit || query.isFetching}
            className="bg-primary rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {query.isFetching ? t("lookup.resolving") : t("lookup.resolve")}
          </button>
        </div>
      </section>

      {/* Error state */}
      {query.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("lookup.failed", { error: query.error.message })}
        </p>
      )}

      {/* Resolution summary */}
      {hasResult && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
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
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("lookup.load")}
            </button>
          </div>

          {resolved.length > 0 && (
            <ul className="flex flex-col gap-2">
              {resolved.map((product) => (
                <li
                  key={product.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <span className="flex items-start gap-2">
                      <span className="flex-none rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600">
                        {product.reference}
                      </span>
                      <span className="font-semibold text-neutral-900">
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
                  <span className="text-primary shrink-0 font-semibold">
                    {product.price}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {unresolved.length > 0 && (
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
          )}
        </section>
      )}
    </div>
  );
}
