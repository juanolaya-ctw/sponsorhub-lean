import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";

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
      <body className="min-h-screen antialiased">
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
