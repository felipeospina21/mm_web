"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { t } from "@/i18n/messages";
import Image from "next/image";
import { useEditorDraft } from "./editor-draft-context";
import { ConfirmModal } from "./confirm-modal";

interface NavBarClientProps {
  /** Display name/email of the signed-in user, shown on the right. */
  userLabel: string | null;
}

/**
 * Top navigation bar. Links between the catalog and the editor and
 * highlights the active route. Rendered only for signed-in users
 * (see NavBar server wrapper).
 *
 * When the editor has an unsaved draft, clicking a nav link is intercepted
 * with a confirm dialog — client-side route changes never fire `beforeunload`,
 * so without this guard the draft would be discarded silently.
 */
export function NavBarClient({ userLabel }: NavBarClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isDraft } = useEditorDraft();
  // Pending navigation target held while the leave-confirm dialog is open.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navLinks = [
    { href: "/", label: t("nav.newQuotation") },
    { href: "/editor", label: t("nav.editor") },
  ] as const;

  const handleNavClick = (event: React.MouseEvent, href: string) => {
    // Only guard when leaving an existing draft for a different route.
    if (href === pathname || !isDraft) return;
    event.preventDefault();
    setPendingHref(href);
  };

  const confirmLeave = () => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  };

  const handleSignOut = async () => {
    // redirect:false keeps NextAuth from building an absolute URL from the
    // server host; we navigate ourselves and force a refresh so server
    // components re-read the now-empty session.
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="flex h-14 min-w-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
        <Image
          src="/x.png"
          alt="magic medios logo"
          width={40}
          height={40}
          className="mr-1 shrink-0 sm:mr-2.5"
        />
        {navLinks.map(({ href, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={(event) => handleNavClick(event, href)}
              aria-current={isActive ? "page" : undefined}
              className={`px-2 py-1.5 text-xs font-medium whitespace-nowrap transition sm:px-3 sm:text-sm ${
                isActive
                  ? "border-primary border-b-2"
                  : "hover:text-primary text-neutral-600"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {userLabel && (
          <span className="text-secondary hidden max-w-48 truncate text-sm md:inline">
            {userLabel}
          </span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="border-black-200 text-primary rounded-lg border px-2 py-1.5 text-xs font-medium transition hover:bg-neutral-100 sm:px-3 sm:text-sm"
        >
          {t("nav.signOut")}
        </button>
      </div>

      <ConfirmModal
        open={pendingHref !== null}
        title={t("editor.leaveTitle")}
        message={t("editor.leaveMessage")}
        confirmLabel={t("editor.leaveConfirm")}
        cancelLabel={t("editor.keepEditing")}
        onConfirm={confirmLeave}
        onCancel={() => setPendingHref(null)}
      />
    </nav>
  );
}
