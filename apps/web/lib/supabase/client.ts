import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Client Components. Usa la clave anon — sujeto
 * a RLS. El sponsor autenticado solo ve lo que sus policies permiten.
 * Apunta al schema `sponsorhub` (ver lib/supabase/server.ts).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "sponsorhub" } }
  );
}
