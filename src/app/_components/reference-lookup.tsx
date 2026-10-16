"use client";

import { useState } from "react";

import { api } from "@/trpc/react";
import { t } from "@/i18n/messages";
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
