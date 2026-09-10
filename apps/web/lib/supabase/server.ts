import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para Server Components y API routes.
 * Usa la clave anon + RLS — respeta las policies de sponsor_usuarios.
 *
 * IMPORTANTE: este proyecto Supabase es COMPARTIDO con otro producto
 * de ColombiaTech que vive en el schema `public`. Todo lo de
 * SponsorHub vive en `sponsorhub` — por eso `db: { schema: "sponsorhub" }`
 * abajo. Sin esto, el cliente apuntaría a `public` por defecto y no
 * encontraría ninguna tabla.
 *
 * Requiere que `sponsorhub` esté en Settings > API > Exposed schemas
 * del dashboard de Supabase — si no, esto falla con "schema not found"
 * aunque las tablas existan.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "sponsorhub" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura
            // de cookies — se ignora si hay middleware refrescando la sesión.
          }
        },
      },
    }
  );
}
