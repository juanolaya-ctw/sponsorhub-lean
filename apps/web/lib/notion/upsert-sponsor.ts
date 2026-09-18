import type { NotionSponsorPage } from "@/lib/notion/fetch-sponsors";
import { mapGovtechSponsor } from "@/lib/notion/mappers/sponsor.mapper";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Campos que Notion puede escribir en sponsors.
 * Todo lo demás (contacto_*, logo_url, estado_id, compromisos, archivos)
 * lo gestiona el panel admin / portal — el sync NUNCA los pisa.
 */
export type NotionSponsorSyncFields = {
  evento_id: string;
  notion_page_id: string;
  nombre: string;
  paquete: string | null;
  updated_from_notion_at: string;
};

export function toNotionSyncFields(
  page: NotionSponsorPage,
  eventoId: string,
): NotionSponsorSyncFields | { error: string } {
  const mapped = mapGovtechSponsor(page);
  if ("error" in mapped) return mapped;

  return {
    evento_id: eventoId,
    notion_page_id: mapped.notion_page_id,
    nombre: mapped.nombre,
    paquete: mapped.paquete,
    updated_from_notion_at: new Date().toISOString(),
  };
}

/**
 * Upsert de sponsor desde Notion: solo nombre + paquete.
 * ON CONFLICT (evento_id, notion_page_id) no toca contacto ni operativos.
 */
export async function upsertSponsorFromNotion(
  supabase: AdminClient,
  fields: NotionSponsorSyncFields,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("sponsors").upsert(
    {
      evento_id: fields.evento_id,
      notion_page_id: fields.notion_page_id,
      nombre: fields.nombre,
      paquete: fields.paquete,
      updated_from_notion_at: fields.updated_from_notion_at,
    },
    { onConflict: "evento_id,notion_page_id" },
  );

  return { error: error?.message ?? null };
}
