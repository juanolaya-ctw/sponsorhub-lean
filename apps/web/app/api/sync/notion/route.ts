import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterSponsorFields,
  filterSpeakerFields,
  filterEntregableFields,
} from "@/lib/notion/allowlist";

/**
 * Cron de sync Notion -> Postgres. Invocado por Vercel Cron cada 1-5 min
 * (ver vercel.json). NO se ejecuta en el request del sponsor — el
 * dashboard siempre lee de Postgres, nunca de Notion en vivo.
 *
 * Flujo por evento activo:
 *   1. Leer sponsors del CS Board de Notion (data_source_id en `eventos`)
 *   2. Filtrar por allowlist (lib/notion/allowlist.ts)
 *   3. Traducir compromisos (lib/notion/mappers/compromiso.mapper.ts)
 *   4. Upsert en Postgres, marcando updated_from_notion_at
 *
 * TODO (Claude Code): implementar el cliente de Notion real
 * (@notionhq/client) contra collection://2d299829-d217-8123-aab7-000bf1a05ee8
 * — este archivo es el contrato/esqueleto, no la implementación completa.
 */

function assertCronSecret(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error("unauthorized");
  }
}

export async function GET(request: Request) {
  try {
    assertCronSecret(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: eventosActivos, error: eventosError } = await supabase
    .from("eventos")
    .select("id, slug, notion_source_id")
    .eq("estado", "activo")
    .not("notion_source_id", "is", null);

  if (eventosError) {
    return NextResponse.json({ error: eventosError.message }, { status: 500 });
  }

  const resultados: Array<{ evento: string; sponsorsSincronizados: number }> = [];

  for (const evento of eventosActivos ?? []) {
    // TODO: reemplazar por la llamada real a la API de Notion
    // const notionRecords = await fetchSponsorsFromNotion(evento.notion_source_id);
    const notionRecords: unknown[] = [];

    let count = 0;
    for (const rawRecord of notionRecords) {
      const sponsorFields = filterSponsorFields(rawRecord as Record<string, unknown>);
      const speakerFields = filterSpeakerFields(rawRecord as Record<string, unknown>);
      const entregableFields = filterEntregableFields(rawRecord as Record<string, unknown>);

      const { data: sponsorRow, error: upsertError } = await supabase
        .from("sponsors")
        .upsert(
          {
            evento_id: evento.id,
            ...sponsorFields,
            ...speakerFields,
            ...entregableFields,
            updated_from_notion_at: new Date().toISOString(),
          },
          { onConflict: "evento_id,notion_page_id" }
        )
        .select("id")
        .single();

      if (upsertError || !sponsorRow) {
        console.error(`[sync] Error upserting sponsor en ${evento.slug}:`, upsertError);
        continue;
      }

      // Compromisos: traducidos, no mapeados 1:1 (ver mapper)
      // const compromisos = mapCompromisosFromNotion(rawRecord, sponsorRow.id);
      // await supabase.from("compromisos").upsert(compromisos, { onConflict: "sponsor_id,tipo" });

      count++;
    }

    resultados.push({ evento: evento.slug, sponsorsSincronizados: count });
  }

  return NextResponse.json({ ok: true, resultados });
}
