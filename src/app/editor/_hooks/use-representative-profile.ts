import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { capitalizeName } from "@/lib/capitalize-name";
import { formatQuotationFooter } from "@/lib/company-profile";
import { t } from "@/i18n/messages";
import { api } from "@/trpc/react";
import type { PageData, QuotationData } from "../_components/types";

interface UseRepresentativeProfileOptions {
  isDirty: boolean;
  isSaved: boolean;
  pendingLoadId: string | null;
  pagesRef: RefObject<PageData[]>;
  metaRef: RefObject<QuotationData>;
  replacePages: (pages: PageData[]) => void;
  resetHistory: (pages: PageData[]) => void;
}

/** Hydrates a clean draft's representative header and footer from the user profile. */
export function useRepresentativeProfile({
  isDirty,
  isSaved,
  pendingLoadId,
  pagesRef,
  metaRef,
  replacePages,
  resetHistory,
}: UseRepresentativeProfileOptions): void {
  const representativeQuery = api.quotation.representative.useQuery();
  const representativeAppliedRef = useRef(false);

  useEffect(() => {
    const representative = representativeQuery.data;
    if (
      !representative ||
      representativeAppliedRef.current ||
      isSaved ||
      isDirty ||
      pendingLoadId
    ) {
      return;
    }
    representativeAppliedRef.current = true;

    const representativeName = capitalizeName(representative.name ?? "");
    const representativePhone = representative.phone ?? "";
    const representativePhoneExtension =
      representative.phoneExt == null ? "" : String(representative.phoneExt);
    const representativeCellphone = representative.cellphone ?? "";
    const representativeEmail = representative.email ?? "";
    const representativeText = [
      t("template.representative"),
      representativeName,
      `${representativeCellphone} / ${representativePhone} ext. ${representativePhoneExtension}`,
      representativeEmail,
    ].join("\n");

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
      ...metaRef.current,
      representativeName,
      representativePhone,
      representativePhoneExtension,
      representativeCellphone,
      representativeEmail,
    };
    replacePages(nextPages);
    resetHistory(nextPages);
  }, [
    representativeQuery.data,
    isSaved,
    isDirty,
    pendingLoadId,
    pagesRef,
    metaRef,
    replacePages,
    resetHistory,
  ]);
}
