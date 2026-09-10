import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { getSponsorContext } from "@/lib/portal/sponsor";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sponsor = await getSponsorContext();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-white px-4">
        <Link href="/portal/dashboard">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{sponsor.sponsorNombre}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
