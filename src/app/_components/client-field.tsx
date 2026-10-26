"use client";

import { useState } from "react";

import { SearchableSelect } from "@/components/searchable-select";
import { api, type RouterOutputs } from "@/trpc/react";
import { t } from "@/i18n/messages";
import { capitalizeName } from "@/lib/capitalize-name";

type ClientRecord = RouterOutputs["customer"]["list"][number];

interface ClientFieldProps {
  value: string | null;
  onChange: (client: ClientRecord | null, contactId: string | null) => void;
}

const EMPTY_FORM = {
  name: "",
  companyId: "",
  address: "",
  phone: "",
};

interface ContactForm {
  name: string;
  phone: string;
  email: string;
}

const EMPTY_CONTACT: ContactForm = { name: "", phone: "", email: "" };

export function ClientField({ value, onChange }: ClientFieldProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOptionValue, setSelectedOptionValue] = useState<string | null>(
    null,
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contacts, setContacts] = useState<ContactForm[]>([
    { ...EMPTY_CONTACT },
  ]);
  const clientsQuery = api.customer.list.useQuery(undefined, {
    staleTime: 60_000,
  });
  const utils = api.useUtils();
  const createClient = api.customer.create.useMutation({
    onSuccess: async (client) => {
      await utils.customer.list.invalidate();
      setSelectedOptionValue(
        client.contacts[0]
          ? `${client.id}::${client.contacts[0].id}`
          : `${client.id}::none`,
      );
      setSelectedClientId(client.id);
          onChange(client, client.contacts[0]?.id ?? null);
      setForm(EMPTY_FORM);
      setContacts([{ ...EMPTY_CONTACT }]);
      setIsCreateOpen(false);
    },
  });

  const updateField = (field: keyof typeof EMPTY_FORM, next: string) => {
    setForm((current) => ({ ...current, [field]: next }));
  };

  const updateContact = (
    index: number,
    field: keyof ContactForm,
    next: string,
  ) => {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: next } : contact,
      ),
    );
  };

  const clientOptions = (clientsQuery.data ?? []).flatMap((client) => {
    const contacts = client.contacts.length > 0 ? client.contacts : [null];
    return contacts.map((contact) => ({
      value: `${client.id}::${contact?.id ?? "none"}`,
      label: [client.name, contact?.name, client.userAlias]
        .filter((part): part is string => Boolean(part))
        .map(capitalizeName)
        .join(" - "),
      clientId: client.id,
    }));
  });
  const selectedOption =
    clientOptions.find(
      (option) =>
        option.value === selectedOptionValue &&
        option.clientId === (selectedClientId ?? value),
    ) ?? clientOptions.find((option) => option.clientId === value);

  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-sm font-semibold text-neutral-800"
        htmlFor="client-select"
      >
        {t("client.label")}
      </label>
      <SearchableSelect
        id="client-select"
        label={t("client.select")}
        searchLabel={t("client.search")}
        noResultsLabel={t("client.noResults")}
        options={clientOptions}
        value={selectedOption?.value ?? null}
        onChange={(optionValue) => {
          const option = clientOptions.find(
            (item) => item.value === optionValue,
          );
          if (!option) return;
          setSelectedOptionValue(option.value);
          setSelectedClientId(option.clientId);
          const selected = clientsQuery.data?.find(
            (client) => client.id === option.clientId,
          );
          const selectedContactId = option.value.split("::")[1];
          onChange(
            selected ?? null,
            selectedContactId && selectedContactId !== "none"
              ? selectedContactId
              : null,
          );
        }}
        footerAction={{
          label: t("client.addNew"),
          onSelect: () => setIsCreateOpen(true),
        }}
      />
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
              createClient.mutate({
                ...form,
                contacts: contacts.filter((contact) => contact.name.trim()),
              });
            }}
          >
            <h2 className="text-lg font-semibold text-neutral-900">
              {t("client.addTitle")}
            </h2>
            <p className="text-sm text-neutral-600">
              {t("client.requiredFields")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "client.companyName", true],
                  ["companyId", "client.companyId", false],
                  ["address", "client.address", false],
                  ["phone", "client.phone", false],
                ] as const
              ).map(([field, label, required]) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-neutral-700">
                    {t(label)}
                    {required && (
                      <span aria-hidden="true" className="text-red-600">
                        {" *"}
                      </span>
                    )}
                  </span>
                  <input
                    required={required}
                    type="text"
                    value={form[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    className="focus:ring-primary rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-white focus:ring-1"
                  />
                </label>
              ))}
            </div>
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-neutral-800">
                {t("client.contacts")}
              </h3>
              {contacts.map((contact, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border border-neutral-200 p-3 sm:grid-cols-3"
                >
                  {(
                    [
                      ["name", "client.contactName", true],
                      ["phone", "client.contactPhone", true],
                      ["email", "client.contactEmail", true],
                    ] as const
                  ).map(([field, label, required]) => (
                    <label key={field} className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-neutral-700">
                        {t(label)}
                        <span aria-hidden="true" className="text-red-600">
                          {" *"}
                        </span>
                      </span>
                      <input
                        required={required}
                        type={field === "email" ? "email" : "text"}
                        value={contact[field]}
                        onChange={(event) =>
                          updateContact(index, field, event.target.value)
                        }
                        className="focus:ring-primary rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-white focus:ring-1"
                      />
                    </label>
                  ))}
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setContacts((current) =>
                          current.filter(
                            (_, contactIndex) => contactIndex !== index,
                          ),
                        )
                      }
                      className="text-left text-sm text-red-700 sm:col-span-3"
                    >
                      {t("client.removeContact")}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setContacts((current) => [...current, { ...EMPTY_CONTACT }])
                }
                className="self-start text-sm font-medium text-green-700"
              >
                {t("client.addContact")}
              </button>
            </section>
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
                disabled={
                  createClient.isPending ||
                  !form.name.trim() ||
                  contacts.length === 0 ||
                  contacts.some(
                    (contact) =>
                      !contact.name.trim() ||
                      !contact.phone.trim() ||
                      !contact.email.trim(),
                  )
                }
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
