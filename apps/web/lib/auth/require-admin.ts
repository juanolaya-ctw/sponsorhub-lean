import { cache } from "react";
import { redirect } from "next/navigation";
import { LOGIN_PATH, parseRol, roleFromAccessToken } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  let rol =
    roleFromAccessToken(session?.access_token) ?? parseRol(user?.app_metadata);

  // Compatibilidad temporal para access tokens emitidos antes de activar
  // el Custom Access Token Hook. React.cache limita este fallback a una
  // consulta por render, sin repetirla entre layouts y páginas.
  if (user && !rol) {
    const { data: profile } = await supabase
      .from("sponsor_usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();
    rol = parseRol(profile);
  }

  return {
    supabase,
    user,
    rol,
  };
});

async function requireRole(expected: "admin_ct" | "sponsor") {
  const context = await getAuthContext();

  if (!context.user || context.rol !== expected) {
    redirect(LOGIN_PATH);
  }

  return {
    supabase: context.supabase,
    user: context.user,
    rol: context.rol,
  };
}

export function requireAdmin() {
  return requireRole("admin_ct");
}

export function requireSponsor() {
  return requireRole("sponsor");
}
