"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { t } from "@/i18n/messages";

interface LoginFormProps {
  mode: "credentials" | "microsoft";
  callbackUrl?: string;
}

function LoginFormInner({
  mode,
  callbackUrl: defaultCallbackUrl,
}: LoginFormProps) {
  const searchParams = useSearchParams();
  const callbackUrl =
    searchParams.get("callbackUrl") ?? defaultCallbackUrl ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCredentialsSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError(t("login.invalidCredentials"));
        setIsSubmitting(false);
        return;
      }
      window.location.assign(result?.url ?? callbackUrl);
    } catch (cause) {
      console.error("Credentials sign-in failed:", cause);
      setError(t("login.failed"));
      setIsSubmitting(false);
    }
  }

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
    <section className="flex w-full max-w-sm flex-col gap-4 p-8">
      <p className="mb-2 text-lg font-medium tracking-wide text-white/75">
        Cotizador Magic Medios
      </p>
      <h1 className="text-2xl font-bold text-white">{t("login.title")}</h1>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {mode === "credentials" ? (
        <form
          onSubmit={handleCredentialsSignIn}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-sm text-white">
            {t("login.email")}
            <input
              autoComplete="username"
              className="rounded-lg bg-white px-3 py-2 text-neutral-900"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-white">
            {t("login.password")}
            <input
              autoComplete="current-password"
              className="rounded-lg bg-white px-3 py-2 text-neutral-900"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-primary mt-2 rounded-lg bg-white px-4 py-3 font-semibold transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("login.signingIn") : t("login.submit")}
          </button>
        </form>
      ) : (
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
      )}
    </section>
  );
}

export function LoginForm({ mode, callbackUrl }: LoginFormProps) {
  return (
    <Suspense>
      <LoginFormInner mode={mode} callbackUrl={callbackUrl} />
    </Suspense>
  );
}
