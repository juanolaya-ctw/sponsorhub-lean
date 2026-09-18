import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { AdminConfigLink } from "@/components/admin/AdminConfigLink";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-white px-4">
        <Link href="/admin/selector-evento" className="flex items-center">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-3">
          <AdminConfigLink />
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
