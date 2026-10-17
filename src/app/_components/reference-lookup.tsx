"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/trpc/react";
import { t } from "@/i18n/messages";
import {
  setPendingManualQuotation,
  setPendingQuotationClient,
} from "@/lib/quotation-load";
import { clearQuotationProducts } from "@/lib/quotation-selection";
import { ClientField } from "./client-field";
import { ReferencesSection } from "./references-section";
import { LookupSummary } from "./lookup-summary";

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
  // The SKUs the user actually submitted (drives the query). Empty until the
  // first "Resolve" so nothing runs on mount.
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  const query = api.product.resolveReferences.useQuery(
    { references: submitted },
    {
      enabled: submitted.length > 0,
      // Lookups are live; don't serve a stale cache for a changed list.
      staleTime: 0,
    },
  );

  const hasResult = submitted.length > 0 && query.isSuccess;

  const handleStartManualQuotation = () => {
    if (!clientId) return;
    clearQuotationProducts();
    setPendingQuotationClient(clientId);
    setPendingManualQuotation();
    router.push("/editor");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-10">
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
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <p className="mb-3 text-sm text-neutral-600">
            {t("lookup.manualInstructions")}
          </p>
          <button
            type="button"
            onClick={handleStartManualQuotation}
            disabled={!clientId}
            className="w-full rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {t("lookup.startManual")}
          </button>
        </div>
      </section>

      <ReferencesSection
        isFetching={query.isFetching}
        setSubmitted={setSubmitted}
      />

      {query.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("lookup.failed", { error: query.error.message })}
        </p>
      )}

      {hasResult && (
        <LookupSummary
          data={query.data}
          clientId={clientId}
          submitted={submitted}
        />
      )}
    </div>
  );
}
