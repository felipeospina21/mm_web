"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { t } from "@/i18n/messages";
import Image from "next/image";

interface NavBarClientProps {
  /** Display name/email of the signed-in user, shown on the right. */
  userLabel: string | null;
}

/**
 * Top navigation bar. Links between the catalog and the editor and
 * highlights the active route. Rendered only for signed-in users
 * (see NavBar server wrapper).
 */
export function NavBarClient({ userLabel }: NavBarClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navLinks = [
    { href: "/", label: t("nav.newQuotation") },
    { href: "/editor", label: t("nav.editor") },
  ] as const;

  const handleSignOut = async () => {
    // redirect:false keeps NextAuth from building an absolute URL from the
    // server host; we navigate ourselves and force a refresh so server
    // components re-read the now-empty session.
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div className="flex items-center gap-1">
        <Image
          src="/x.png"
          alt="magic medios logo"
          width={50}
          height={50}
          className="mr-2.5"
        />
        {navLinks.map(({ href, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`px-3 py-1.5 text-sm font-medium transition ${
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

      <div className="flex items-center gap-4">
        {userLabel && (
          <span className="text-secondary text-sm">{userLabel}</span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="border-black-200 text-primary rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-100"
        >
          {t("nav.signOut")}
        </button>
      </div>
    </nav>
  );
}
