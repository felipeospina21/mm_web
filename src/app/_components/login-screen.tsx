import { env } from "@/env";

import { LoginForm } from "./login-form";

interface LoginScreenProps {
  callbackUrl?: string;
}

/** Shared signed-out screen for the home page and protected app routes. */
export function LoginScreen({ callbackUrl = "/" }: LoginScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-(--color-primary) to-(--color-secondary) px-4">
      <LoginForm
        mode={env.NODE_ENV === "development" ? "credentials" : "microsoft"}
        callbackUrl={callbackUrl}
      />
    </main>
  );
}
