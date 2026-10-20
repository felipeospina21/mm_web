import { env } from "@/env";

import { LoginForm } from "./login-form";
import Image from "next/image";

interface LoginScreenProps {
  callbackUrl?: string;
}

/** Shared signed-out screen for the home page and protected app routes. */
export function LoginScreen({ callbackUrl = "/" }: LoginScreenProps) {
  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center bg-linear-to-b from-(--color-primary) to-(--color-secondary) px-6 py-12 md:px-10">
        <LoginForm
          mode={env.NODE_ENV === "development" ? "credentials" : "microsoft"}
          callbackUrl={callbackUrl}
        />
      </section>
      <section className="hidden min-h-screen items-center justify-center bg-white px-10 py-12 md:flex">
        <Image
          src="/full_logo_transparent.png"
          alt="Magic Medios logo"
          width={400}
          height={100}
          priority
          className="h-auto w-full max-w-md object-contain"
        />
      </section>
    </main>
  );
}
