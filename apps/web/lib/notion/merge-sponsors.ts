import { tryNormalizeNotionId } from "@/lib/notion/client"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export type SponsorDuplicateCandidate = {
  keepId: string
  keepNombre: string
  archiveId: string
  archiveNombre: string
  reason: string
}

function normalizeNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Detecta sponsors vacíos duplicados por nombre normalizado en un evento.
 * Conserva el que tiene notion_page_id + más compromisos; archiva candidatos.
 */
export async function findEmptyDuplicateSponsors(
  supabase: AdminClient,
  eventoId: string,
): Promise<SponsorDuplicateCandidate[]> {
  const { data: sponsors, error } = await supabase
    .from("sponsors")
    .select("id, nombre, notion_page_id, archivado_at")
    .eq("evento_id", eventoId)
    .is("archivado_at", null)

  if (error) throw new Error(error.message)

  const rows = sponsors ?? []
  const byName = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = normalizeNombre(row.nombre as string)
    const list = byName.get(key) ?? []
    list.push(row)
    byName.set(key, list)
  }

  const candidates: SponsorDuplicateCandidate[] = []

  for (const [, group] of byName) {
    if (group.length < 2) continue

    const scored = await Promise.all(
      group.map(async (sponsor) => {
        const { count: compromisos } = await supabase
          .from("compromisos")
          .select("id", { count: "exact", head: true })
          .eq("sponsor_id", sponsor.id)
          .is("archivado_at", null)
        const { count: accesos } = await supabase
          .from("accesos_personas")
          .select("id", { count: "exact", head: true })
          .eq("sponsor_id", sponsor.id)
        const { count: archivos } = await supabase
          .from("archivos")
          .select("id", { count: "exact", head: true })
          .eq("sponsor_id", sponsor.id)

        const score =
          (compromisos ?? 0) * 10 +
          (accesos ?? 0) * 2 +
          (archivos ?? 0) +
          (sponsor.notion_page_id ? 5 : 0)

        return {
          sponsor,
          score,
          compromisos: compromisos ?? 0,
        }
      }),
    )

    scored.sort((a, b) => b.score - a.score)
    const keeper = scored[0]!
    for (const loser of scored.slice(1)) {
      if (loser.compromisos > 0 && loser.score >= keeper.score * 0.5) {
        // Ambos tienen data significativa → no auto-merge
        continue
      }
      candidates.push({
        keepId: keeper.sponsor.id as string,
        keepNombre: keeper.sponsor.nombre as string,
        archiveId: loser.sponsor.id as string,
        archiveNombre: loser.sponsor.nombre as string,
        reason:
          loser.compromisos === 0
            ? "Duplicado vacío (0 compromisos activos)"
            : "Duplicado por nombre con menos actividad",
      })
    }
  }

  return candidates
}

/**
 * Mueve compromisos/archivos/accesos del duplicado → canónico y soft-archiva.
 */
export async function mergeSponsors(
  supabase: AdminClient,
  keepId: string,
  archiveId: string,
): Promise<{ error: string | null }> {
  if (keepId === archiveId) {
    return { error: "No se puede fusionar un sponsor consigo mismo." }
  }

  const { data: both, error: loadError } = await supabase
    .from("sponsors")
    .select("id, evento_id, notion_page_id")
    .in("id", [keepId, archiveId])

  if (loadError) return { error: loadError.message }
  if ((both ?? []).length !== 2) {
    return { error: "Uno o ambos sponsors no existen." }
  }
  const keep = both!.find((s) => s.id === keepId)!
  const archive = both!.find((s) => s.id === archiveId)!
  if (keep.evento_id !== archive.evento_id) {
    return { error: "Los sponsors deben ser del mismo evento." }
  }

  // Mover compromisos del archive → keep, evitando unique (sponsor, notion_page)
  const { data: archiveCompromisos, error: compError } = await supabase
    .from("compromisos")
    .select("id, notion_page_id, archivado_at")
    .eq("sponsor_id", archiveId)

  if (compError) return { error: compError.message }

  const { data: keepCompromisos } = await supabase
    .from("compromisos")
    .select("id, notion_page_id")
    .eq("sponsor_id", keepId)
    .not("notion_page_id", "is", null)
    .is("archivado_at", null)

  const keepPages = new Set(
    (keepCompromisos ?? [])
      .map((c) => tryNormalizeNotionId(c.notion_page_id as string))
      .filter(Boolean),
  )

  for (const row of archiveCompromisos ?? []) {
    const pageNorm = row.notion_page_id
      ? tryNormalizeNotionId(row.notion_page_id as string)
      : null

    if (pageNorm && keepPages.has(pageNorm)) {
      // Ya existe en keep → archivar el del duplicado y reasignar FKs
      await supabase
        .from("archivos")
        .update({
          compromiso_id: (keepCompromisos ?? []).find(
            (c) =>
              tryNormalizeNotionId(c.notion_page_id as string) === pageNorm,
          )?.id,
          sponsor_id: keepId,
        })
        .eq("compromiso_id", row.id)

      await supabase
        .from("accesos_personas")
        .update({
          compromiso_id: (keepCompromisos ?? []).find(
            (c) =>
              tryNormalizeNotionId(c.notion_page_id as string) === pageNorm,
          )?.id,
          sponsor_id: keepId,
        })
        .eq("compromiso_id", row.id)

      await supabase
        .from("compromisos")
        .update({ archivado_at: new Date().toISOString() })
        .eq("id", row.id)
    } else {
      const { error: moveError } = await supabase
        .from("compromisos")
        .update({ sponsor_id: keepId })
        .eq("id", row.id)
      if (moveError) return { error: moveError.message }
      if (pageNorm) keepPages.add(pageNorm)
    }
  }

  await supabase
    .from("archivos")
    .update({ sponsor_id: keepId })
    .eq("sponsor_id", archiveId)

  await supabase
    .from("accesos_personas")
    .update({ sponsor_id: keepId })
    .eq("sponsor_id", archiveId)

  // Reasignar usuarios del duplicado si no hay conflicto de unique.
  const { error: usersError } = await supabase
    .from("sponsor_usuarios")
    .update({ sponsor_id: keepId })
    .eq("sponsor_id", archiveId)
  if (usersError) {
    console.warn(
      `[merge-sponsors] sponsor_usuarios ${archiveId}→${keepId}: ${usersError.message}`,
    )
  }

  const { error: archiveError } = await supabase
    .from("sponsors")
    .update({ archivado_at: new Date().toISOString() })
    .eq("id", archiveId)

  return { error: archiveError?.message ?? null }
}

export async function softArchiveSponsors(
  supabase: AdminClient,
  sponsorIds: string[],
): Promise<{ archivados: number; error: string | null }> {
  if (sponsorIds.length === 0) return { archivados: 0, error: null }
  const { error } = await supabase
    .from("sponsors")
    .update({ archivado_at: new Date().toISOString() })
    .in("id", sponsorIds)
  if (error) return { archivados: 0, error: error.message }
  return { archivados: sponsorIds.length, error: null }
}
