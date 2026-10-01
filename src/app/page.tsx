import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

import { LoginForm } from "./_components/login-form";
import { ProductCard } from "./_components/product-card";
import { QuotationBar } from "./_components/quotation-bar";

export default async function Home() {
  const session = await auth();

  // Not signed in — show the login form.
  if (!session?.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4">
        <LoginForm />
      </main>
    );
  }

  const products = await api.product.list();

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <h1 className="text-lg font-semibold text-neutral-900">
          Product Catalog
        </h1>
        <span className="text-sm text-neutral-500">
          Pick products to build your quotation
        </span>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <QuotationBar />
    </main>
  );
}
