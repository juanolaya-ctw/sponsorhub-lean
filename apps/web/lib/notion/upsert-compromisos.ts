import type { LabBeneficioRow } from "@/lib/notion/fetch-lab-beneficios"
import { tryNormalizeNotionId } from "@/lib/notion/client"
import { mapEstadoNotionToHubNombre } from "@/lib/notion/map-estado-lab"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export type UpsertCompromisosResult = {
  compromisosSincronizados: number
  archivados: number
  errores: string[]
}

type ExistingCompromiso = {
  id: string
  sponsor_id: string
  notion_page_id: string
  archivado_at: string | null
}

function normalizePageId(notionPageId: string): string {
  return tryNormalizeNotionId(notionPageId) ?? notionPageId.toLowerCase()
}

function pairKey(sponsorId: string, notionPageId: string): string {
  return `${sponsorId}::${normalizePageId(notionPageId)}`
}

async function resolveEstadoIdByNombre(
  supabase: AdminClient,
  eventoId: string,
  nombre: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("estados_compromiso")
    .select("id, evento_id")
    .eq("nombre", nombre)
    .or(`evento_id.eq.${eventoId},evento_id.is.null`)

  if (error) {
    console.warn(`[lab-beneficios] estado "${nombre}":`, error.message)
    return null
  }

  const rows = data ?? []
  const preferred =
    rows.find((row) => row.evento_id === eventoId) ??
    rows.find((row) => row.evento_id == null)
  return (preferred?.id as string | undefined) ?? null
}

export type UpsertCompromisosPrune = boolean | "scoped"

/**
 * Soft-archive compromisos synced cuyo notion_page_id está en la lista.
 * No toca filas del panel (notion_page_id NULL).
 */
export async function softArchiveCompromisosByNotionPageIds(
  supabase: AdminClient,
  eventoId: string,
  notionPageIds: string[],
): Promise<{ archivados: number; error: string | null }> {
  const normalized = [
    ...new Set(
      notionPageIds
        .map((id) => normalizePageId(id))
        .filter(Boolean),
    ),
  ]
  if (normalized.length === 0) {
    return { archivados: 0, error: null }
  }

  const { data: sponsors, error: sponsorsError } = await supabase
    .from("sponsors")
    .select("id")
    .eq("evento_id", eventoId)

  if (sponsorsError) {
    return { archivados: 0, error: sponsorsError.message }
  }

  const sponsorIds = (sponsors ?? []).map((s) => s.id as string)
  if (sponsorIds.length === 0) {
    return { archivados: 0, error: null }
  }

  const { data: rows, error: selectError } = await supabase
    .from("compromisos")
    .select("id, notion_page_id")
    .in("sponsor_id", sponsorIds)
    .is("archivado_at", null)
    .not("notion_page_id", "is", null)

  if (selectError) {
    return { archivados: 0, error: selectError.message }
  }

  const pageSet = new Set(normalized)
  const toArchive = (rows ?? [])
    .filter((row) =>
      pageSet.has(normalizePageId(row.notion_page_id as string)),
    )
    .map((row) => row.id as string)

  if (toArchive.length === 0) {
    return { archivados: 0, error: null }
  }

  const { error: updateError } = await supabase
    .from("compromisos")
    .update({ archivado_at: new Date().toISOString() })
    .in("id", toArchive)

  if (updateError) {
    return { archivados: 0, error: updateError.message }
  }

  return { archivados: toArchive.length, error: null }
}

/**
 * Upsert de compromisos desde LAB Beneficios.
 * - Explota Sponsor (CRM) → N filas (una por sponsor).
 * - Match por (sponsor_id, notion_page_id normalizado).
 * - Update: tipo / tipo_beneficio / categoria_beneficio / estado_id / reactiva.
 * - Insert nuevos con estado mapeado desde Notion (o Pendiente).
 * - Prune soft-delete (archivado_at), nunca hard-delete.
 * - Nunca toca notion_page_id IS NULL (panel).
 */
export async function upsertCompromisosFromLabBeneficios(
  supabase: AdminClient,
  eventoId: string,
  rows: LabBeneficioRow[],
  options?: { prune?: UpsertCompromisosPrune },
): Promise<UpsertCompromisosResult> {
  const pruneMode: UpsertCompromisosPrune =
    options?.prune === undefined ? true : options.prune
  const errores: string[] = []
  let compromisosSincronizados = 0
  let archivados = 0

  const { data: sponsorsData, error: sponsorsError } = await supabase
    .from("sponsors")
    .select("id, notion_page_id")
    .eq("evento_id", eventoId)
    .is("archivado_at", null)

  if (sponsorsError) {
    return {
      compromisosSincronizados: 0,
      archivados: 0,
      errores: [`Sponsors del evento: ${sponsorsError.message}`],
    }
  }

  const sponsorByNotionId = new Map<string, string>()
  for (const sponsor of sponsorsData ?? []) {
    const pageId = tryNormalizeNotionId(sponsor.notion_page_id as string)
    if (!pageId) continue
    sponsorByNotionId.set(pageId, sponsor.id as string)
    sponsorByNotionId.set(
      (sponsor.notion_page_id as string).toLowerCase(),
      sponsor.id as string,
    )
  }

  const pendienteId = await resolveEstadoIdByNombre(
    supabase,
    eventoId,
    "Pendiente",
  )
  if (!pendienteId) {
    return {
      compromisosSincronizados: 0,
      archivados: 0,
      errores: [
        'No existe estado "Pendiente" en estados_compromiso (global o del evento).',
      ],
    }
  }

  // Las funciones internas pierden el narrowing de `pendienteId`: lo fijamos como string.
  const pendienteEstadoId: string = pendienteId
  const estadoIdCache = new Map<string, string | null>()
  estadoIdCache.set("Pendiente", pendienteEstadoId)

  async function estadoIdForNotion(
    estadoNotion: string | null,
  ): Promise<string> {
    const hubNombre = mapEstadoNotionToHubNombre(estadoNotion)
    if (estadoIdCache.has(hubNombre)) {
      return estadoIdCache.get(hubNombre) ?? pendienteEstadoId
    }
    const resolved = await resolveEstadoIdByNombre(
      supabase,
      eventoId,
      hubNombre,
    )
    estadoIdCache.set(hubNombre, resolved)
    return resolved ?? pendienteEstadoId
  }

  const sponsorIds = [...new Set(sponsorByNotionId.values())]
  const existingByPair = new Map<string, ExistingCompromiso>()
  const duplicateIds: string[] = []

  if (sponsorIds.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("compromisos")
      .select("id, sponsor_id, notion_page_id, archivado_at")
      .in("sponsor_id", sponsorIds)
      .not("notion_page_id", "is", null)

    if (existingError) {
      return {
        compromisosSincronizados: 0,
        archivados: 0,
        errores: [`Compromisos existentes: ${existingError.message}`],
      }
    }

    for (const row of existing ?? []) {
      if (!row.notion_page_id) continue
      // Preferir fila activa si hay duplicados; si todas archivadas, la primera.
      const mapped: ExistingCompromiso = {
        id: row.id as string,
        sponsor_id: row.sponsor_id as string,
        notion_page_id: row.notion_page_id as string,
        archivado_at: (row.archivado_at as string | null) ?? null,
      }
      const key = pairKey(mapped.sponsor_id, mapped.notion_page_id)
      const prev = existingByPair.get(key)
      if (!prev) {
        existingByPair.set(key, mapped)
        continue
      }
      if (prev.archivado_at && !mapped.archivado_at) {
        duplicateIds.push(prev.id)
        existingByPair.set(key, mapped)
        continue
      }
      if (!prev.archivado_at && mapped.archivado_at) {
        duplicateIds.push(mapped.id)
        continue
      }
      duplicateIds.push(mapped.id)
    }
  }

  const syncedPairs = new Set<string>()
  const batchPageIds = new Set(
    rows.map((lab) => normalizePageId(lab.notion_page_id)),
  )

  for (const lab of rows) {
    const labPageId = normalizePageId(lab.notion_page_id)
    const estadoId = await estadoIdForNotion(lab.estado_notion)

    for (const rawCrmId of lab.sponsor_crm_page_ids) {
      const crmId = tryNormalizeNotionId(rawCrmId) ?? rawCrmId.toLowerCase()
      const sponsorId =
        sponsorByNotionId.get(crmId) ??
        sponsorByNotionId.get(rawCrmId.toLowerCase())

      if (!sponsorId) {
        const detail = `LAB "${lab.nombre}": sponsor CRM ${rawCrmId} no está en Supabase (evento ${eventoId}).`
        console.warn(`[lab-beneficios] ${detail}`)
        errores.push(detail)
        continue
      }

      const key = pairKey(sponsorId, labPageId)
      syncedPairs.add(key)
      const existing = existingByPair.get(key)

      if (existing) {
        const { error } = await supabase
          .from("compromisos")
          .update({
            tipo: lab.nombre,
            tipo_beneficio: lab.tipo_beneficio,
            categoria_beneficio: lab.categoria_beneficio,
            notion_page_id: labPageId,
            estado_id: estadoId,
            archivado_at: null,
          })
          .eq("id", existing.id)

        if (error) {
          const detail = `Update compromiso ${existing.id} (${lab.nombre}): ${error.message}`
          console.error(`[lab-beneficios] ${detail}`)
          errores.push(detail)
          continue
        }
      } else {
        const { error } = await supabase.from("compromisos").insert({
          sponsor_id: sponsorId,
          notion_page_id: labPageId,
          tipo: lab.nombre,
          tipo_beneficio: lab.tipo_beneficio,
          categoria_beneficio: lab.categoria_beneficio,
          estado_id: estadoId,
          archivado_at: null,
        })

        if (error) {
          const detail = `Insert compromiso "${lab.nombre}" → sponsor ${sponsorId}: ${error.message}`
          console.error(`[lab-beneficios] ${detail}`)
          errores.push(detail)
          continue
        }
      }

      compromisosSincronizados++
    }
  }

  const toArchiveIds: string[] = [...duplicateIds]
  if (pruneMode === true || pruneMode === "scoped") {
    for (const [key, row] of existingByPair) {
      if (syncedPairs.has(key)) continue
      if (row.archivado_at) continue
      if (
        pruneMode === "scoped" &&
        !batchPageIds.has(normalizePageId(row.notion_page_id))
      ) {
        continue
      }
      toArchiveIds.push(row.id)
    }
  }

  if (toArchiveIds.length > 0) {
    const uniqueIds = [...new Set(toArchiveIds)]
    const { error: archiveError } = await supabase
      .from("compromisos")
      .update({ archivado_at: new Date().toISOString() })
      .in("id", uniqueIds)

    if (archiveError) {
      const detail = `Soft-archive compromisos huérfanos: ${archiveError.message}`
      console.error(`[lab-beneficios] ${detail}`)
      errores.push(detail)
    } else {
      archivados = uniqueIds.length
      console.info(
        `[lab-beneficios] Soft-archive: ${archivados} compromiso(s).`,
      )
    }
  }

  return { compromisosSincronizados, archivados, errores }
}
