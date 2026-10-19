"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { t } from "@/i18n/messages";

function LoginFormInner() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleMicrosoftSignIn() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn("microsoft-entra-id", { callbackUrl });
    } catch (cause) {
      console.error("Microsoft sign-in failed:", cause);
      setError(t("login.failed"));
      setIsSubmitting(false);
    }
  }

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white/10 p-8 backdrop-blur">
      <h1 className="text-2xl font-bold text-white">{t("login.title")}</h1>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button
        type="button"
        onClick={handleMicrosoftSignIn}
        disabled={isSubmitting}
        className="text-primary mt-2 rounded-lg bg-white px-4 py-3 font-semibold transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? t("login.signingIn")
          : t("login.continueWithMicrosoft")}
      </button>
    </section>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
