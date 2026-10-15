import { defaultLocale, t, type Locale } from "@/i18n/messages";

/** Business-wide contact details; keep these out of the per-user profile. */
export const companyProfile = {
  address: "Calle 6 sur #50 - 30, Medellin",
  website: "www.magicmedios.com",
} as const;

type FooterContactData = {
  representativeCellphone?: string | null;
  representativePhone?: string | null;
  representativePhoneExtension?: string | null;
  representativeEmail?: string | null;
};

export function formatQuotationFooter(
  contact: FooterContactData,
  locale: Locale = defaultLocale,
): string {
  const companyLine = [companyProfile.address, companyProfile.website]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("  |  ");

  const phone = contact.representativePhone?.trim() ?? "";
  const extension = contact.representativePhoneExtension?.trim() ?? "";
  const phoneWithExtension = [
    phone,
    extension ? `${t("template.extension", {}, locale)} ${extension}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const representativeLine = [
    contact.representativeCellphone?.trim()
      ? `${t("template.cellphone", {}, locale)}: ${contact.representativeCellphone.trim()}`
      : "",
    phoneWithExtension
      ? `${t("template.phone", {}, locale)}: ${phoneWithExtension}`
      : "",
    contact.representativeEmail?.trim()
      ? `${t("template.email", {}, locale)}: ${contact.representativeEmail.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  return [companyLine, representativeLine].filter(Boolean).join("\n");
}
