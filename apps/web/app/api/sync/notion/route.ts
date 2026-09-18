import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GOVTECH_EVENT_SLUG,
  tryNormalizeNotionId,
} from "@/lib/notion/client";
import { fetchSponsorsFromNotion } from "@/lib/notion/fetch-sponsors";
import {
  toNotionSyncFields,
  upsertSponsorFromNotion,
} from "@/lib/notion/upsert-sponsor";

/**
 * Cron Notion -> Postgres (fallback horario). Solo GovTech Summit 2026.
 * Solo escribe nombre + paquete (mismo helper que el webhook).
 * Los compromisos los crea el trigger del catálogo.
 */
export const maxDuration = 60;

function assertCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    throw new Error("unauthorized");
  }
}

export async function GET(request: Request) {
  try {
    assertCronSecret(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.NOTION_API_KEY) {
    return NextResponse.json(
      { error: "NOTION_API_KEY no está configurada." },
      { status: 500 },
    );
  }

  const supabase = createAdminClient();

  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("id, slug, notion_source_id, estado")
    .eq("slug", GOVTECH_EVENT_SLUG)
    .maybeSingle();

  if (eventoError) {
    const permissionDenied = /permission denied/i.test(eventoError.message);
    return NextResponse.json(
      {
        error: eventoError.message,
        hint: permissionDenied
          ? "Ejecuta supabase/migrations/0008_grant_schema_sponsorhub.sql en el SQL Editor de Supabase."
          : undefined,
      },
      { status: 500 },
    );
  }
  if (!evento) {
    return NextResponse.json(
      { error: `No existe el evento ${GOVTECH_EVENT_SLUG}.` },
      { status: 404 },
    );
  }
  if (evento.estado !== "activo") {
    return NextResponse.json(
      {
        error: `El evento ${GOVTECH_EVENT_SLUG} no está activo (estado=${evento.estado}).`,
      },
      { status: 409 },
    );
  }

  const fromDb = tryNormalizeNotionId(
    (evento.notion_source_id as string | null) ?? null,
  );
  const fromEnv = tryNormalizeNotionId(
    process.env.NOTION_GOVTECH_DATA_SOURCE_ID ?? null,
  );
  // El .env manda: si no, el cron seguiría pegándole al data_source_id viejo
  // persistido en Postgres (p.ej. Acciones FU).
  const dataSourceId = fromEnv ?? fromDb;

  if (!dataSourceId) {
    return NextResponse.json(
      {
        error:
          "Ni eventos.notion_source_id ni NOTION_GOVTECH_DATA_SOURCE_ID tienen un UUID de 32 hex. El ntn_… es el token (NOTION_API_KEY). El ID de la tabla sale de la URL de Notion o de Settings de la database (data_source_id).",
      },
      { status: 400 },
    );
  }

  if (dataSourceId !== evento.notion_source_id) {
    const { error: persistError } = await supabase
      .from("eventos")
      .update({ notion_source_id: dataSourceId })
      .eq("id", evento.id);
    if (persistError) {
      console.warn(
        "[sync] No se pudo persistir notion_source_id:",
        persistError.message,
      );
    }
  }

  let fetchResult;
  try {
    fetchResult = await fetchSponsorsFromNotion(dataSourceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error consultando Notion.";
    console.error("[sync] Notion:", message);
    return NextResponse.json(
      { error: message, dataSourceId },
      { status: 502 },
    );
  }

  const { pages, totalInNotion, estadosVistos, aviso, muestraPropiedades } =
    fetchResult;

  const errores: string[] = [];
  let sponsorsSincronizados = 0;

  for (const page of pages) {
    const fields = toNotionSyncFields(page, evento.id as string);
    if ("error" in fields) {
      console.warn(`[sync] ${fields.error}`);
      errores.push(fields.error);
      continue;
    }

    const { error: upsertError } = await upsertSponsorFromNotion(
      supabase,
      fields,
    );

    if (upsertError) {
      const detail = `Upsert ${fields.nombre}: ${upsertError}`;
      console.error(`[sync] ${detail}`);
      errores.push(detail);
      continue;
    }

    sponsorsSincronizados++;
  }

  return NextResponse.json({
    ok: true,
    evento: GOVTECH_EVENT_SLUG,
    dataSourceId,
    totalInNotion,
    estadosVistos,
    aviso,
    muestraPropiedades,
    sponsorsSincronizados,
    errores,
  });
}
