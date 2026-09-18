import type { LabBeneficioRow } from "@/lib/notion/fetch-lab-beneficios";
import { tryNormalizeNotionId } from "@/lib/notion/client";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type UpsertCompromisosResult = {
  compromisosSincronizados: number;
  errores: string[];
};

type ExistingCompromiso = {
  id: string;
  sponsor_id: string;
  notion_page_id: string;
};

function pairKey(sponsorId: string, notionPageId: string): string {
  return `${sponsorId}::${notionPageId}`;
}

async function resolvePendienteEstadoId(
  supabase: AdminClient,
  eventoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("estados_compromiso")
    .select("id, evento_id")
    .eq("nombre", "Pendiente")
    .or(`evento_id.eq.${eventoId},evento_id.is.null`);

  if (error) {
    console.warn("[lab-beneficios] estado Pendiente:", error.message);
    return null;
  }

  const rows = data ?? [];
  const preferred =
    rows.find((row) => row.evento_id === eventoId) ??
    rows.find((row) => row.evento_id == null);
  return (preferred?.id as string | undefined) ?? null;
}

/**
 * Upsert de compromisos desde LAB Beneficios.
 * - Explota Sponsor (CRM) → N filas (una por sponsor).
 * - ON CONFLICT (sponsor_id, notion_page_id): actualiza tipo / tipo_beneficio /
 *   categoria_beneficio. NUNCA toca estado_id.
 * - Insert nuevos con estado Pendiente.
 * - Prune: borra compromisos govtech con notion_page_id que ya no están en LAB.
 *   Nunca borra notion_page_id IS NULL (creados en el panel).
 */
export async function upsertCompromisosFromLabBeneficios(
  supabase: AdminClient,
  eventoId: string,
  rows: LabBeneficioRow[],
): Promise<UpsertCompromisosResult> {
  const errores: string[] = [];
  let compromisosSincronizados = 0;

  const { data: sponsorsData, error: sponsorsError } = await supabase
    .from("sponsors")
    .select("id, notion_page_id")
    .eq("evento_id", eventoId);

  if (sponsorsError) {
    return {
      compromisosSincronizados: 0,
      errores: [`Sponsors del evento: ${sponsorsError.message}`],
    };
  }

  const sponsorByNotionId = new Map<string, string>();
  for (const sponsor of sponsorsData ?? []) {
    const pageId = tryNormalizeNotionId(sponsor.notion_page_id as string);
    if (!pageId) continue;
    sponsorByNotionId.set(pageId, sponsor.id as string);
    // Notion a veces compara con/sin guiones — indexar ambas formas.
    sponsorByNotionId.set(
      (sponsor.notion_page_id as string).toLowerCase(),
      sponsor.id as string,
    );
  }

  const pendienteId = await resolvePendienteEstadoId(supabase, eventoId);
  if (!pendienteId) {
    return {
      compromisosSincronizados: 0,
      errores: [
        'No existe estado "Pendiente" en estados_compromiso (global o del evento).',
      ],
    };
  }

  const sponsorIds = [...new Set(sponsorByNotionId.values())];
  const existingByPair = new Map<string, ExistingCompromiso>();

  if (sponsorIds.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("compromisos")
      .select("id, sponsor_id, notion_page_id")
      .in("sponsor_id", sponsorIds)
      .not("notion_page_id", "is", null);

    if (existingError) {
      return {
        compromisosSincronizados: 0,
        errores: [`Compromisos existentes: ${existingError.message}`],
      };
    }

    for (const row of existing ?? []) {
      if (!row.notion_page_id) continue;
      existingByPair.set(
        pairKey(row.sponsor_id as string, row.notion_page_id as string),
        {
          id: row.id as string,
          sponsor_id: row.sponsor_id as string,
          notion_page_id: row.notion_page_id as string,
        },
      );
    }
  }

  const syncedPairs = new Set<string>();

  for (const lab of rows) {
    for (const rawCrmId of lab.sponsor_crm_page_ids) {
      const crmId = tryNormalizeNotionId(rawCrmId) ?? rawCrmId.toLowerCase();
      const sponsorId =
        sponsorByNotionId.get(crmId) ??
        sponsorByNotionId.get(rawCrmId.toLowerCase());

      if (!sponsorId) {
        const detail = `LAB "${lab.nombre}": sponsor CRM ${rawCrmId} no está en Supabase (evento ${eventoId}).`;
        console.warn(`[lab-beneficios] ${detail}`);
        errores.push(detail);
        continue;
      }

      const key = pairKey(sponsorId, lab.notion_page_id);
      syncedPairs.add(key);
      const existing = existingByPair.get(key);

      if (existing) {
        const { error } = await supabase
          .from("compromisos")
          .update({
            tipo: lab.nombre,
            tipo_beneficio: lab.tipo_beneficio,
            categoria_beneficio: lab.categoria_beneficio,
          })
          .eq("id", existing.id);

        if (error) {
          const detail = `Update compromiso ${existing.id} (${lab.nombre}): ${error.message}`;
          console.error(`[lab-beneficios] ${detail}`);
          errores.push(detail);
          continue;
        }
      } else {
        const { error } = await supabase.from("compromisos").insert({
          sponsor_id: sponsorId,
          notion_page_id: lab.notion_page_id,
          tipo: lab.nombre,
          tipo_beneficio: lab.tipo_beneficio,
          categoria_beneficio: lab.categoria_beneficio,
          estado_id: pendienteId,
        });

        if (error) {
          const detail = `Insert compromiso "${lab.nombre}" → sponsor ${sponsorId}: ${error.message}`;
          console.error(`[lab-beneficios] ${detail}`);
          errores.push(detail);
          continue;
        }
      }

      compromisosSincronizados++;
    }
  }

  // Prune: LAB rows removed in Notion → delete synced compromisos.
  // Nunca tocar notion_page_id IS NULL (panel).
  const toDeleteIds: string[] = [];
  for (const [key, row] of existingByPair) {
    if (!syncedPairs.has(key)) {
      toDeleteIds.push(row.id);
    }
  }

  if (toDeleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("compromisos")
      .delete()
      .in("id", toDeleteIds);

    if (deleteError) {
      const detail = `Prune compromisos huérfanos: ${deleteError.message}`;
      console.error(`[lab-beneficios] ${detail}`);
      errores.push(detail);
    } else {
      console.info(
        `[lab-beneficios] Prune: ${toDeleteIds.length} compromiso(s) eliminados.`,
      );
    }
  }

  return { compromisosSincronizados, errores };
}
