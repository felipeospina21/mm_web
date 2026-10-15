"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "@/trpc/react";
import { t } from "@/i18n/messages";

type ClientRecord = RouterOutputs["customer"]["list"][number];

interface ClientFieldProps {
  value: string | null;
  onChange: (client: ClientRecord | null) => void;
}

const EMPTY_FORM = {
  name: "",
  companyId: "",
  address: "",
  phone: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
};

export function ClientField({ value, onChange }: ClientFieldProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const clientsQuery = api.customer.list.useQuery();
  const utils = api.useUtils();
  const createClient = api.customer.create.useMutation({
    onSuccess: async (client) => {
      await utils.customer.list.invalidate();
      onChange(client);
      setForm(EMPTY_FORM);
      setIsCreateOpen(false);
    },
  });

  const updateField = (field: keyof typeof EMPTY_FORM, next: string) => {
    setForm((current) => ({ ...current, [field]: next }));
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-sm font-semibold text-neutral-800"
        htmlFor="client-select"
      >
        {t("client.label")}
      </label>
      <select
        id="client-select"
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value === "__add_new__") {
            setIsCreateOpen(true);
            return;
          }
          const selected = clientsQuery.data?.find(
            (client) => client.id === event.target.value,
          );
          onChange(selected ?? null);
        }}
        className="focus:ring-primary w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-white focus:ring-1"
      >
        <option value="">{t("client.select")}</option>
        {clientsQuery.data?.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
        <option value="__add_new__">{t("client.addNew")}</option>
      </select>
      {clientsQuery.error && (
        <p role="alert" className="text-sm text-red-700">
          {t("client.loadFailed")}
        </p>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <form
            className="flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              createClient.mutate(form);
            }}
          >
            <h2 className="text-lg font-semibold text-neutral-900">
              {t("client.addTitle")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "client.name", true],
                  ["companyId", "client.companyId", false],
                  ["address", "client.address", false],
                  ["phone", "client.phone", false],
                  ["contactName", "client.contactName", false],
                  ["contactPhone", "client.contactPhone", false],
                  ["contactEmail", "client.contactEmail", false],
                ] as const
              ).map(([field, label, required]) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-neutral-700">
                    {t(label)}
                  </span>
                  <input
                    required={required}
                    type={field === "contactEmail" ? "email" : "text"}
                    value={form[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    className="focus:ring-primary rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-white focus:ring-1"
                  />
                </label>
              ))}
            </div>
            {createClient.error && (
              <p role="alert" className="text-sm text-red-700">
                {createClient.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={createClient.isPending || !form.name.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {createClient.isPending
                  ? t("client.saving")
                  : t("client.create")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
