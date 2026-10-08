import type { NextRequest } from "next/server";
import { listPublishedArticulos } from "@/lib/public/articulos";
import { publicCorsPreflight, publicJson } from "@/lib/public/cors";

export async function OPTIONS() {
  return publicCorsPreflight();
}

export async function GET(req: NextRequest) {
  const evento = req.nextUrl.searchParams.get("evento")?.trim();
  if (!evento) {
    return publicJson(
      { error: "Parámetro evento es obligatorio (ej. govtech-2026)." },
      { status: 400 },
    );
  }

  const origin = req.nextUrl.origin;
  try {
    const { data, error } = await listPublishedArticulos(evento, origin);
    if (error || !data) {
      const status = error === "Evento no encontrado." ? 404 : 500;
      return publicJson({ error: error ?? "Error al listar artículos." }, { status });
    }
    return publicJson({ articles: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return publicJson({ error: message }, { status: 500 });
  }
}
