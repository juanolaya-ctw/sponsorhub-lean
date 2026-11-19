"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import {
  RESET_PATH,
  runSolicitarReset,
  type ContactoParaReset,
} from "@/lib/auth/reset-password-core"
import { createAdminClient } from "@/lib/supabase/admin"

const siteOrigin = (): string => {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  if (configured) return configured.replace(/\/$/, "")
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000"
  return ""
}

/** «Olvidé mi contraseña» → correo de Supabase que aterriza en /restablecer. */
export async function solicitarRestablecimientoPassword(
  email: string,
): Promise<{ mensaje: string }> {
  const admin = createAdminClient()
  const result = await runSolicitarReset(
    {
      findContactosByEmail: async (normalized) => {
        const { data } = await admin
          .from("media_cliente_contactos")
          .select("activo, auth_user_id")
          .eq("email", normalized)
          .limit(10)
        const out: ContactoParaReset[] = []
        for (const row of data ?? []) {
          const authUserId = (row.auth_user_id as string | null) ?? null
          if (!authUserId || row.activo === false) continue
          const { data: profile } = await admin
            .from("sponsor_usuarios")
            .select("rol, activo")
            .eq("id", authUserId)
            .maybeSingle()
          const { data: au } = await admin.auth.admin.getUserById(authUserId)
          out.push({
            contactoActivo: row.activo !== false,
            authUserId,
            profileRol: (profile?.rol as string | null) ?? null,
            profileActivo: (profile?.activo as boolean | null) ?? null,
            authEmail: au.user?.email ?? null,
          })
        }
        return out
      },
      sendResetEmail: async (normalized) => {
        const origin = siteOrigin()
        if (!origin) return { error: "no_origin" }
        // Flujo implícito (sin PKCE): el enlace funciona aunque se abra en
        // otro dispositivo o navegador distinto al que lo pidió.
        const anon = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              flowType: "implicit",
              persistSession: false,
              autoRefreshToken: false,
            },
          },
        )
        const { error } = await anon.auth.resetPasswordForEmail(normalized, {
          redirectTo: `${origin}${RESET_PATH}`,
        })
        return { error: error ? "reset_failed" : null }
      },
    },
    email,
  )
  return { mensaje: result.mensaje }
}
