import type { NextRequest } from "next/server";
import { getPublishedArticuloBySlug } from "@/lib/public/articulos";
import { publicCorsPreflight, publicJson } from "@/lib/public/cors";

export async function OPTIONS() {
  return publicCorsPreflight();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const evento = req.nextUrl.searchParams.get("evento")?.trim();
  if (!evento) {
    return publicJson(
      { error: "Parámetro evento es obligatorio (ej. govtech-2026)." },
      { status: 400 },
    );
  }
  if (!slug?.trim()) {
    return publicJson({ error: "Slug inválido." }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  try {
    const { data, error, notFound } = await getPublishedArticuloBySlug(
      slug.trim(),
      evento,
      origin,
    );
    if (notFound || !data) {
      return publicJson(
        { error: error ?? "Artículo no encontrado." },
        { status: 404 },
      );
    }
    if (error) {
      return publicJson({ error }, { status: 500 });
    }
    return publicJson({ article: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return publicJson({ error: message }, { status: 500 });
  }
}
