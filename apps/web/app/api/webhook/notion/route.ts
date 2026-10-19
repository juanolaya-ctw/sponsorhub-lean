import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNotionClient,
  GOVTECH_EVENT_SLUG,
  GOVTECH_SPONSOR_NAME_FIELDS,
  tryNormalizeNotionId,
} from "@/lib/notion/client";
import {
  LAB_BENEFICIO_TITLE,
  LAB_SPONSOR_CRM,
  mapLabBeneficioPage,
} from "@/lib/notion/fetch-lab-beneficios";
import {
  softArchiveCompromisosByNotionPageIds,
  upsertCompromisosFromLabBeneficios,
} from "@/lib/notion/upsert-compromisos";
import {
  toNotionSyncFields,
  upsertSponsorFromNotion,
} from "@/lib/notion/upsert-sponsor";

/**
 * Webhook Notion → Postgres (tiempo casi real).
 * Notion aún no firma estos payloads; NOTION_WEBHOOK_SECRET queda
 * documentado para cuando agreguen verificación.
 *
 * Enruta por parent de la página:
 * - CRM sponsors (NOTION_GOVTECH_DATA_SOURCE_ID) → upsert nombre + paquete
 * - LAB Beneficios (NOTION_LAB_BENEFICIOS_ID) → upsert compromiso(s)
 * - Otro → ignore (fallback por columnas si database_id ≠ data_source_id)
 *
 * Siempre 200: Notion reintenta si no recibe 200.
 */
export const maxDuration = 30;

type NotionWebhookBody = {
  entity?: { id?: string; type?: string };
  verification_token?: string;
};

type NotionPageParent = {
  type?: string;
  database_id?: string;
  data_source_id?: string;
};

type NotionPageWithProps = {
  id: string;
  archived?: boolean;
  parent?: NotionPageParent;
  properties: Record<string, unknown>;
};

type PageSource = "crm" | "lab-beneficios";

async function resolveGovtechEvent(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<{ id: string; notion_source_id: string | null } | null> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, notion_source_id")
    .eq("slug", GOVTECH_EVENT_SLUG)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) {
    console.error("[webhook/notion] evento:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id as string,
    notion_source_id: (data.notion_source_id as string | null) ?? null,
  };
}

function parentNotionIds(parent: NotionPageParent | undefined): string[] {
  if (!parent) return [];
  const ids = [
    tryNormalizeNotionId(parent.data_source_id ?? null),
    tryNormalizeNotionId(parent.database_id ?? null),
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

function idsMatch(a: string, b: string): boolean {
  return a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();
}

function hasProperty(
  properties: Record<string, unknown>,
  name: string,
): boolean {
  const target = name.trim().toLowerCase();
  return Object.keys(properties).some(
    (key) => key.trim().toLowerCase() === target,
  );
}

function looksLikeLabBeneficios(properties: Record<string, unknown>): boolean {
  return (
    hasProperty(properties, LAB_BENEFICIO_TITLE) &&
    hasProperty(properties, LAB_SPONSOR_CRM)
  );
}

function looksLikeCrmSponsors(properties: Record<string, unknown>): boolean {
  return GOVTECH_SPONSOR_NAME_FIELDS.some((name) =>
    hasProperty(properties, name),
  );
}

function resolvePageSource(
  parentIds: string[],
  properties: Record<string, unknown>,
  crmCandidates: string[],
  labCandidates: string[],
): PageSource | null {
  for (const parentId of parentIds) {
    if (labCandidates.some((id) => idsMatch(parentId, id))) {
      return "lab-beneficios";
    }
    if (crmCandidates.some((id) => idsMatch(parentId, id))) {
      return "crm";
    }
  }

  // Fallback: el env puede ser data_source_id y el parent database_id.
  if (looksLikeLabBeneficios(properties)) return "lab-beneficios";
  if (looksLikeCrmSponsors(properties)) return "crm";
  return null;
}

async function handleSponsorPage(
  supabase: ReturnType<typeof createAdminClient>,
  eventoId: string,
  page: NotionPageWithProps,
): Promise<void> {
  const fields = toNotionSyncFields(
    { id: page.id, properties: page.properties },
    eventoId,
  );

  if ("error" in fields) {
    console.error(`[webhook/notion] ${fields.error}`);
    return;
  }

  const { error } = await upsertSponsorFromNotion(supabase, fields);
  if (error) {
    console.error(`[webhook/notion] Upsert ${fields.nombre}: ${error}`);
  }
}

async function handleLabBeneficioPage(
  supabase: ReturnType<typeof createAdminClient>,
  eventoId: string,
  page: NotionPageWithProps,
): Promise<void> {
  if (page.archived) {
    const archive = await softArchiveCompromisosByNotionPageIds(
      supabase,
      eventoId,
      [page.id],
    );
    if (archive.error) {
      console.error(`[webhook/notion] archive LAB ${page.id}: ${archive.error}`);
    } else if (archive.archivados > 0) {
      console.info(
        `[webhook/notion] LAB ${page.id} archivada: ${archive.archivados} compromiso(s).`,
      );
    }
    return;
  }

  const mapped = mapLabBeneficioPage({
    id: page.id,
    properties: page.properties,
  });

  if ("skip" in mapped) {
    console.warn(`[webhook/notion] ${mapped.skip}`);
    // CRM vacío o fila inválida → soft-archive pairs de esta página LAB.
    if (/Sponsor \(CRM\) vacío/i.test(mapped.skip)) {
      const archive = await softArchiveCompromisosByNotionPageIds(
        supabase,
        eventoId,
        [page.id],
      );
      if (archive.error) {
        console.error(
          `[webhook/notion] archive empty-CRM ${page.id}: ${archive.error}`,
        );
      }
    }
    return;
  }

  const result = await upsertCompromisosFromLabBeneficios(
    supabase,
    eventoId,
    [mapped],
    // Solo poda sponsors quitados de esta fila LAB; no toca otras páginas.
    { prune: "scoped" },
  );

  for (const err of result.errores) {
    console.warn(`[webhook/notion] ${err}`);
  }
  if (result.compromisosSincronizados > 0) {
    console.info(
      `[webhook/notion] LAB "${mapped.nombre}": ${result.compromisosSincronizados} compromiso(s).`,
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NotionWebhookBody;
    console.log("webhook body:", JSON.stringify(body));

    if (body.verification_token) {
      console.log(
        "[webhook/notion] verification_token:",
        body.verification_token,
      );
      return NextResponse.json({
        ok: true,
        verification_token: body.verification_token,
      });
    }

    const entity = body.entity;
    if (!entity?.id || entity.type !== "page") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!process.env.NOTION_API_KEY) {
      console.error("[webhook/notion] NOTION_API_KEY no configurada.");
      return NextResponse.json({ ok: true });
    }

    const supabase = createAdminClient();
    const evento = await resolveGovtechEvent(supabase);
    if (!evento) {
      console.error(
        `[webhook/notion] Evento ${GOVTECH_EVENT_SLUG} no encontrado o inactivo.`,
      );
      return NextResponse.json({ ok: true });
    }

    const notion = getNotionClient();
    let page: unknown;
    try {
      page = await notion.pages.retrieve({ page_id: entity.id });
    } catch (retrieveErr) {
      const message =
        retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr);
      // Página borrada en Notion → soft-archive compromisos asociados.
      if (/could not find|404|not found/i.test(message)) {
        const archive = await softArchiveCompromisosByNotionPageIds(
          supabase,
          evento.id,
          [entity.id],
        );
        console.info(
          `[webhook/notion] page missing ${entity.id}: archivados=${archive.archivados}`,
        );
        return NextResponse.json({ ok: true, archived: true });
      }
      throw retrieveErr;
    }

    if (!page || typeof page !== "object" || !("properties" in page)) {
      console.error(`[webhook/notion] Página ${entity.id} sin properties.`);
      return NextResponse.json({ ok: true });
    }

    const pageWithProps = page as unknown as NotionPageWithProps;
    const parentIds = parentNotionIds(pageWithProps.parent);

    const crmCandidates = [
      tryNormalizeNotionId(process.env.NOTION_GOVTECH_DATA_SOURCE_ID ?? null),
      tryNormalizeNotionId(evento.notion_source_id),
    ].filter((id): id is string => Boolean(id));

    const labCandidates = [
      tryNormalizeNotionId(process.env.NOTION_LAB_BENEFICIOS_ID ?? null),
    ].filter((id): id is string => Boolean(id));

    const source = resolvePageSource(
      parentIds,
      pageWithProps.properties,
      crmCandidates,
      labCandidates,
    );

    if (source === "crm") {
      await handleSponsorPage(supabase, evento.id, pageWithProps);
      return NextResponse.json({ ok: true, source });
    }

    if (source === "lab-beneficios") {
      await handleLabBeneficioPage(supabase, evento.id, pageWithProps);
      return NextResponse.json({ ok: true, source });
    }

    console.info(
      `[webhook/notion] Página ${entity.id} parent=${parentIds.join(",") || "?"} ignorada.`,
    );
    return NextResponse.json({ ok: true, skipped: true });
  } catch (err) {
    console.error(
      "[webhook/notion]",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: true });
  }
}
