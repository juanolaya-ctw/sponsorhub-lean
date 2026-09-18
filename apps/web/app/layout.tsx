import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SponsorHub",
  description: "Portal de sponsors de ColombiaTech",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
