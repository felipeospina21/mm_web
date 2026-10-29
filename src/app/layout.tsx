import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { defaultLocale, t } from "@/i18n/messages";
import { NavBar } from "./_components/nav-bar-server";
import { EditorDraftProvider } from "./_components/editor-draft-context";

export const metadata: Metadata = {
  title: t("metadata.title"),
  description: t("metadata.description"),
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
    <html lang={defaultLocale} className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <EditorDraftProvider>
            <NavBar />
            {children}
          </EditorDraftProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
