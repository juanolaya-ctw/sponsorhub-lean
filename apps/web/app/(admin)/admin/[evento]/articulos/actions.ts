"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { slugify } from "@/lib/admin/slugify";
import {
  ARCHIVOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type ArticuloRow,
  type ArticuloStatus,
  type ImageCrop,
} from "@/lib/admin/articulos";

export type SaveArticuloInput = {
  eventoId: string;
  eventoSlug: string;
  sponsorId: string;
  companyName: string;
  tier: string | null;
  logoUrl: string | null;
  datoImpactante: string;
  articuloCorto: string;
  categoria: string | null;
  status: ArticuloStatus;
  existingId: string | null;
  existingSlug: string | null;
  existingPublishedAt: string | null;
  imageSourcePath: string | null;
  imagenPath: string | null;
  imageCrop: ImageCrop | null;
  /** When true, regenerate imagen_url from imagenPath (publish or new final image). */
  refreshImagenUrl: boolean;
};

export type SaveArticuloResult =
  | { ok: true; articulo: ArticuloRow }
  | { ok: false; error: string };

async function signedUrl(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(ARCHIVOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function saveArticulo(
  input: SaveArticuloInput,
): Promise<SaveArticuloResult> {
  const { supabase } = await requireAdmin();

  const dato = input.datoImpactante.trim();
  if (!dato) {
    return { ok: false, error: "El dato impactante es obligatorio." };
  }
  if (dato.length > 200) {
    return {
      ok: false,
      error: "El dato impactante no puede superar 200 caracteres.",
    };
  }

  const articuloCorto = input.articuloCorto.trim() || null;
  const categoria = input.categoria?.trim() || null;

  let slug = input.existingSlug;
  let publishedAt = input.existingPublishedAt;
  if (input.status === "published") {
    if (!slug) slug = slugify(input.companyName) || `sponsor-${input.sponsorId.slice(0, 8)}`;
    if (!publishedAt) publishedAt = new Date().toISOString();
  }

  let imagenUrl: string | null | undefined = undefined;
  if (input.refreshImagenUrl || input.status === "published") {
    imagenUrl = await signedUrl(supabase, input.imagenPath);
  }

  const payload = {
    evento_id: input.eventoId,
    sponsor_id: input.sponsorId,
    dato_impactante: dato,
    articulo_corto: articuloCorto,
    categoria,
    status: input.status,
    slug,
    published_at: publishedAt,
    image_source_path: input.imageSourcePath,
    imagen_path: input.imagenPath,
    image_crop: input.imageCrop,
    company_name: input.companyName,
    logo_url: input.logoUrl,
    tier: input.tier,
    categoria_text: categoria,
    articulo_texto: articuloCorto,
    ...(imagenUrl !== undefined ? { imagen_url: imagenUrl } : {}),
  };

  if (input.existingId) {
    const { data, error } = await supabase
      .from("articulos")
      .update(payload)
      .eq("id", input.existingId)
      .select("*")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "No se pudo actualizar." };
    }
    revalidatePath(`/admin/${input.eventoSlug}/articulos`);
    return { ok: true, articulo: data as ArticuloRow };
  }

  const { data, error } = await supabase
    .from("articulos")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo crear el artículo." };
  }

  revalidatePath(`/admin/${input.eventoSlug}/articulos`);
  return { ok: true, articulo: data as ArticuloRow };
}

/** Create a signed upload URL for article media (admin session). */
export async function prepareArticuloUpload(
  sponsorId: string,
  filename: string,
): Promise<{ data: { path: string; token: string } | null; error: string | null }> {
  const { supabase } = await requireAdmin();
  const safe = filename
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${sponsorId}/articulos/${Date.now()}_${safe}`;

  const { data, error } = await supabase.storage
    .from(ARCHIVOS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { data: null, error: error?.message ?? "No se pudo preparar la subida." };
  }
  return { data: { path: data.path, token: data.token }, error: null };
}

export type DeleteArticuloResult =
  | { ok: true }
  | { ok: false; error: string };

/** Delete article row and best-effort remove storage objects. */
export async function deleteArticulo(
  articuloId: string,
  eventoSlug: string,
): Promise<DeleteArticuloResult> {
  const { supabase } = await requireAdmin();

  const { data: row, error: fetchError } = await supabase
    .from("articulos")
    .select("id, image_source_path, imagen_path")
    .eq("id", articuloId)
    .maybeSingle();

  if (fetchError || !row) {
    return { ok: false, error: fetchError?.message ?? "Artículo no encontrado." };
  }

  const paths = [row.image_source_path, row.imagen_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );

  const { error: deleteError } = await supabase
    .from("articulos")
    .delete()
    .eq("id", articuloId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (paths.length > 0) {
    await supabase.storage.from(ARCHIVOS_BUCKET).remove(paths);
  }

  revalidatePath(`/admin/${eventoSlug}/articulos`);
  return { ok: true };
}
