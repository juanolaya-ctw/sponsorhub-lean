import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventoBySlugPublic } from "@/lib/public/articulos";
import { publicCorsPreflight, publicJson } from "@/lib/public/cors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS() {
  return publicCorsPreflight();
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicJson({ error: "JSON inválido." }, { status: 400 });
  }

  const emailRaw =
    typeof body === "object" && body && "email" in body
      ? String((body as { email: unknown }).email ?? "")
      : "";
  const eventoRaw =
    typeof body === "object" && body && "evento" in body
      ? String((body as { evento: unknown }).evento ?? "")
      : "";

  const email = emailRaw.trim().toLowerCase();
  const eventoSlug = eventoRaw.trim();

  if (!EMAIL_RE.test(email)) {
    return publicJson(
      { error: "Ingresa un email válido", code: "invalid_email" },
      { status: 400 },
    );
  }
  if (!eventoSlug) {
    return publicJson(
      { error: "Parámetro evento es obligatorio.", code: "missing_evento" },
      { status: 400 },
    );
  }

  const evento = await getEventoBySlugPublic(eventoSlug);
  if (!evento) {
    return publicJson(
      { error: "Evento no encontrado.", code: "evento_not_found" },
      { status: 404 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("newsletter_subscribers").insert({
    evento_id: evento.id,
    email,
  });

  if (error) {
    if (error.code === "23505") {
      return publicJson(
        {
          ok: false,
          code: "already_subscribed",
          message: "Este correo ya está suscrito.",
        },
        { status: 409 },
      );
    }
    return publicJson(
      { error: error.message, code: "insert_failed" },
      { status: 500 },
    );
  }

  return publicJson({
    ok: true,
    message: "¡Listo! Te avisaremos cuando haya nuevas novedades.",
  });
}
