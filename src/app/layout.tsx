import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRX Background Remover",
  description:
    "Process browser-decoded video locally and export transparent PNG frames.",
  applicationName: "BRX Background Remover",

  icons: {
    icon: "/brand/brx-logo.png",
    shortcut: "/brand/brx-logo.png",
    apple: "/brand/brx-logo.png",
  },

  openGraph: {
    title: "BRX Background Remover",
    description:
      "Local person segmentation with transparent PNG frame export.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}