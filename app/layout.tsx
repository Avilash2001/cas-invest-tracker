import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MF Portfolio Analyzer",
  description: "Track and analyze your mutual fund portfolio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
