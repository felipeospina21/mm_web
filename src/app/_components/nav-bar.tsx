"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

/** Navigation targets shown in the navbar for a signed-in user. */
const NAV_LINKS = [
  { href: "/", label: "Catalog" },
  { href: "/editor", label: "Editor" },
] as const;

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
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        {userLabel && (
          <span className="text-sm text-neutral-500">{userLabel}</span>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
