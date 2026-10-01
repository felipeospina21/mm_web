import { auth } from "@/server/auth";

import { NavBarClient } from "./nav-bar";

/**
 * Server wrapper for the navbar. Reads the session and renders the
 * navigation only for signed-in users, so it never shows over the
 * login screen.
 */
export async function NavBar() {
  const session = await auth();

  if (!session?.user) return null;

  const userLabel = session.user.name ?? session.user.email ?? null;

  return <NavBarClient userLabel={userLabel} />;
}
