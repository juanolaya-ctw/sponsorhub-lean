import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNotionClient,
  GOVTECH_EVENT_SLUG,
} from "@/lib/notion/client";
import {
  toNotionSyncFields,
  upsertSponsorFromNotion,
} from "@/lib/notion/upsert-sponsor";

/**
 * Webhook Notion → Postgres (tiempo casi real).
 * Notion aún no firma estos payloads; NOTION_WEBHOOK_SECRET queda
 * documentado para cuando agreguen verificación.
 *
 * Solo actualiza nombre + paquete. Compromisos, contacto y archivos
 * los gestiona el panel / portal.
 */
export const maxDuration = 30;

type NotionWebhookBody = {
  entity?: { id?: string; type?: string };
  verification_token?: string;
};

async function resolveGovtechEventId(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id")
    .eq("slug", GOVTECH_EVENT_SLUG)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) {
    console.error("[webhook/notion] evento:", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

export async function POST(request: Request) {
  // Notion exige 200 aunque el procesamiento falle (reintentos).
  try {
    const body = (await request.json()) as NotionWebhookBody;

    // Handshake de verificación (algunas integraciones lo envían al suscribir).
    if (body.verification_token) {
      return NextResponse.json({ ok: true });
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
    const eventoId = await resolveGovtechEventId(supabase);
    if (!eventoId) {
      console.error(
        `[webhook/notion] Evento ${GOVTECH_EVENT_SLUG} no encontrado o inactivo.`,
      );
      return NextResponse.json({ ok: true });
    }

    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: entity.id });
    if (!("properties" in page)) {
      console.error(`[webhook/notion] Página ${entity.id} sin properties.`);
      return NextResponse.json({ ok: true });
    }

    const fields = toNotionSyncFields(
      {
        id: page.id,
        properties: page.properties as Record<string, unknown>,
      },
      eventoId,
    );

    if ("error" in fields) {
      console.error(`[webhook/notion] ${fields.error}`);
      return NextResponse.json({ ok: true });
    }

    const { error } = await upsertSponsorFromNotion(supabase, fields);
    if (error) {
      console.error(
        `[webhook/notion] Upsert ${fields.nombre}: ${error}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "[webhook/notion]",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: true });
  }
}
