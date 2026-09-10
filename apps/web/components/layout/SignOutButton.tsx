"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_PATH } from "@/lib/auth/roles";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      Cerrar sesión
    </button>
  );
}
