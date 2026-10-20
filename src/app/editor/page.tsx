import { LoginScreen } from "@/app/_components/login-screen";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

import EditorClient from "./editor-client";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Feditor");

  return <EditorClient />;
}
