import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role — BYPASSA Row Level Security.
 *
 * Uso EXCLUSIVO para:
 *   - El cron de sync (app/api/sync/notion/route.ts)
 *   - Operaciones internas de CS que necesiten escribir compromisos/evidencias
 *
 * NUNCA importar esto en un componente de cliente ni en una ruta que
 * responda directo a una request del sponsor autenticado — eso anula
 * toda la protección de sponsor_usuarios + RLS.
 *
 * Apunta al schema `sponsorhub` — ver nota en lib/supabase/server.ts
 * sobre por qué esto es necesario en un proyecto compartido.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "sponsorhub" },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
