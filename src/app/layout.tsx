import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import type { CSSProperties } from "react";

import { TRPCReactProvider } from "@/trpc/react";
import { defaultLocale, t } from "@/i18n/messages";
import { theme } from "@/lib/theme";
import { NavBar } from "./_components/nav-bar-server";

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
      <body
        style={
          {
            "--brand-primary": theme.colors.primary,
            "--brand-secondary": theme.colors.secondary,
          } as CSSProperties
        }
      >
        <TRPCReactProvider>
          <NavBar />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
