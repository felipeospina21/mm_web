import { LoginForm } from "@/app/_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-(--brand-primary) to-(--brand-secondary) px-4">
      <LoginForm />
    </main>
  );
}
