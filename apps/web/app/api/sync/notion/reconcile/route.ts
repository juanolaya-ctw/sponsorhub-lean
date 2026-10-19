import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  GOVTECH_EVENT_SLUG,
  tryNormalizeNotionId,
} from "@/lib/notion/client"
import { fetchLabBeneficiosFromNotion } from "@/lib/notion/fetch-lab-beneficios"
import { fetchSponsorsFromNotion } from "@/lib/notion/fetch-sponsors"
import {
  findEmptyDuplicateSponsors,
  mergeSponsors,
  softArchiveSponsors,
} from "@/lib/notion/merge-sponsors"
import { upsertCompromisosFromLabBeneficios } from "@/lib/notion/upsert-compromisos"
import {
  toNotionSyncFields,
  upsertSponsorFromNotion,
} from "@/lib/notion/upsert-sponsor"

/**
 * Reconciliación Notion ↔ Hub (GovTech).
 * GET  → dry-run (reporte de diferencias)
 * POST ?apply=1 → aplica soft-archives, upserts y merges de sponsors vacíos
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export const maxDuration = 120

function assertCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    throw new Error("unauthorized")
  }
}

function wantsApply(request: Request): boolean {
  const url = new URL(request.url)
  return url.searchParams.get("apply") === "1"
}

async function runReconcile(apply: boolean) {
  const supabase = createAdminClient()

  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("id, slug, notion_source_id, estado")
    .eq("slug", GOVTECH_EVENT_SLUG)
    .maybeSingle()

  if (eventoError) throw new Error(eventoError.message)
  if (!evento) throw new Error(`No existe el evento ${GOVTECH_EVENT_SLUG}.`)
  if (evento.estado !== "activo") {
    throw new Error(`Evento ${GOVTECH_EVENT_SLUG} no activo.`)
  }

  const eventoId = evento.id as string
  const dataSourceId =
    tryNormalizeNotionId(process.env.NOTION_GOVTECH_DATA_SOURCE_ID ?? null) ??
    tryNormalizeNotionId((evento.notion_source_id as string | null) ?? null)

  const labBeneficiosId = tryNormalizeNotionId(
    process.env.NOTION_LAB_BENEFICIOS_ID ?? null,
  )

  if (!dataSourceId) {
    throw new Error("Falta NOTION_GOVTECH_DATA_SOURCE_ID / notion_source_id.")
  }
  if (!labBeneficiosId) {
    throw new Error("Falta NOTION_LAB_BENEFICIOS_ID.")
  }

  const [crm, lab] = await Promise.all([
    fetchSponsorsFromNotion(dataSourceId),
    fetchLabBeneficiosFromNotion(labBeneficiosId),
  ])

  const crmPageIds = new Set(
    crm.pages
      .map((p) => tryNormalizeNotionId(p.id))
      .filter((id): id is string => Boolean(id)),
  )

  const labPageIds = new Set(
    lab.rows.map((r) => tryNormalizeNotionId(r.notion_page_id) ?? r.notion_page_id),
  )

  const { data: hubSponsors } = await supabase
    .from("sponsors")
    .select("id, nombre, notion_page_id, archivado_at")
    .eq("evento_id", eventoId)

  const { count: hubCompromisosActivos } = await supabase
    .from("compromisos")
    .select("id", { count: "exact", head: true })
    .in(
      "sponsor_id",
      (hubSponsors ?? [])
        .filter((s) => !s.archivado_at)
        .map((s) => s.id as string),
    )
    .is("archivado_at", null)

  const { data: hubCompromisosSynced } = await supabase
    .from("compromisos")
    .select("id, sponsor_id, notion_page_id, tipo, archivado_at")
    .in(
      "sponsor_id",
      (hubSponsors ?? []).map((s) => s.id as string),
    )
    .not("notion_page_id", "is", null)
    .is("archivado_at", null)

  const orphans = (hubCompromisosSynced ?? []).filter((c) => {
    const pageId = tryNormalizeNotionId(c.notion_page_id as string)
    return pageId ? !labPageIds.has(pageId) : true
  })

  const sponsorsNotInCrm = (hubSponsors ?? []).filter((s) => {
    if (s.archivado_at) return false
    const pageId = tryNormalizeNotionId(s.notion_page_id as string)
    return pageId ? !crmPageIds.has(pageId) : true
  })

  const duplicateSponsors = await findEmptyDuplicateSponsors(supabase, eventoId)

  const report = {
    ok: true,
    apply,
    evento: GOVTECH_EVENT_SLUG,
    before: {
      sponsorsHub: (hubSponsors ?? []).filter((s) => !s.archivado_at).length,
      sponsorsNotion: crm.pages.length,
      compromisosHubActivos: hubCompromisosActivos ?? 0,
      beneficiosLab: lab.rows.length,
    },
    orphansCompromisos: orphans.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      notion_page_id: c.notion_page_id,
      sponsor_id: c.sponsor_id,
    })),
    sponsorsNotInCrm: sponsorsNotInCrm.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      notion_page_id: s.notion_page_id,
    })),
    duplicateSponsors,
    labSkipped: lab.skipped.slice(0, 50),
  }

  if (!apply) {
    return {
      ...report,
      hint: "POST o GET ?apply=1 para aplicar soft-archive, upsert LAB y merge de duplicados vacíos.",
    }
  }

  const errores: string[] = []
  let sponsorsSincronizados = 0
  let compromisosSincronizados = 0
  let compromisosArchivados = 0
  let sponsorsArchivados = 0
  let mergesAplicados = 0

  for (const page of crm.pages) {
    const fields = toNotionSyncFields(page, eventoId)
    if ("error" in fields) {
      errores.push(fields.error)
      continue
    }
    const { error } = await upsertSponsorFromNotion(supabase, fields)
    if (error) {
      errores.push(error)
      continue
    }
    sponsorsSincronizados++
  }

  const upsertResult = await upsertCompromisosFromLabBeneficios(
    supabase,
    eventoId,
    lab.rows,
    { prune: true },
  )
  compromisosSincronizados = upsertResult.compromisosSincronizados
  compromisosArchivados = upsertResult.archivados
  errores.push(...upsertResult.errores)

  // Soft-archive sponsors no presentes en CRM (candidatos HostDime, etc.)
  // Solo si no tienen compromisos activos con notion_page_id en LAB actual.
  const safeToArchiveSponsorIds: string[] = []
  for (const s of sponsorsNotInCrm) {
    const { count } = await supabase
      .from("compromisos")
      .select("id", { count: "exact", head: true })
      .eq("sponsor_id", s.id as string)
      .is("archivado_at", null)
    if ((count ?? 0) === 0) {
      safeToArchiveSponsorIds.push(s.id as string)
    }
  }
  const archiveSponsorsResult = await softArchiveSponsors(
    supabase,
    safeToArchiveSponsorIds,
  )
  if (archiveSponsorsResult.error) {
    errores.push(archiveSponsorsResult.error)
  } else {
    sponsorsArchivados = archiveSponsorsResult.archivados
  }

  for (const dup of duplicateSponsors) {
    const result = await mergeSponsors(supabase, dup.keepId, dup.archiveId)
    if (result.error) {
      errores.push(
        `Merge ${dup.archiveNombre} → ${dup.keepNombre}: ${result.error}`,
      )
      continue
    }
    mergesAplicados++
  }

  const { count: afterCompromisos } = await supabase
    .from("compromisos")
    .select("id", { count: "exact", head: true })
    .in(
      "sponsor_id",
      (
        (
          await supabase
            .from("sponsors")
            .select("id")
            .eq("evento_id", eventoId)
            .is("archivado_at", null)
        ).data ?? []
      ).map((s) => s.id as string),
    )
    .is("archivado_at", null)

  const { count: afterSponsors } = await supabase
    .from("sponsors")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", eventoId)
    .is("archivado_at", null)

  return {
    ...report,
    applied: {
      sponsorsSincronizados,
      compromisosSincronizados,
      compromisosArchivados,
      sponsorsArchivados,
      mergesAplicados,
    },
    after: {
      sponsorsHub: afterSponsors ?? 0,
      compromisosHubActivos: afterCompromisos ?? 0,
    },
    errores,
  }
}

export async function GET(request: Request) {
  try {
    assertCronSecret(request)
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await runReconcile(wantsApply(request))
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[reconcile]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    assertCronSecret(request)
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await runReconcile(true)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[reconcile]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
