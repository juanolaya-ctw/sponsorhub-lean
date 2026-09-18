import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutButton } from "@/components/layout/SignOutButton";
import {
  DEACTIVATED_ACCOUNT_QUERY,
  LOGIN_PATH,
} from "@/lib/auth/roles";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { createClient } from "@/lib/supabase/server";

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: deactivated } = await supabase
      .from("sponsor_usuarios")
      .select("id")
      .eq("id", user.id)
      .eq("activo", false)
      .maybeSingle();

    if (deactivated) {
      // Cerrar sesión evita el loop middleware: login → portal → login
      await supabase.auth.signOut();
      redirect(`${LOGIN_PATH}?error=${DEACTIVATED_ACCOUNT_QUERY}`);
    }
  }

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
