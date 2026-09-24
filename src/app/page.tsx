import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { LoginForm } from "@/app/_components/login-form";

export default async function Home() {
  const session = await auth();

  // Already signed in — go straight to the quotation editor.
  if (session?.user) {
    redirect("/editor");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4">
      <LoginForm />
    </main>
  );
}
