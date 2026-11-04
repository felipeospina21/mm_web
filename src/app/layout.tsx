import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { NavBar } from "./_components/nav-bar-server";
import { EditorDraftProvider } from "./_components/editor-draft-context";
import { ToastProvider } from "./_components/toast-context";

export const metadata: Metadata = {
  title: "Cotizaciones",
  description: "Crea y administra cotizaciones de productos.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <ToastProvider>
            <EditorDraftProvider>
              <NavBar />
              {children}
            </EditorDraftProvider>
          </ToastProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
