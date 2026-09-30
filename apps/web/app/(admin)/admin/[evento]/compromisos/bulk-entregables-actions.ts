"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ENTREGABLE_TIPOS } from "@/lib/portal/beneficios";

const BUCKET = "sponsorhub-archivos";

function safeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function prepareBulkEntregaUpload(filename: string) {
  await requireAdmin();
  const path = `shared/${crypto.randomUUID()}-${safeFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) return { data: null, error: error.message };
  return { data: { path: data.path, token: data.token }, error: null };
}

export async function finalizeBulkEntregaUpload(
  sponsorIds: string[],
  eventoSlug: string,
  storagePath: string,
  filename: string,
  tipo: string,
) {
  const { supabase, user } = await requireAdmin();
  if (!ENTREGABLE_TIPOS.includes(tipo as (typeof ENTREGABLE_TIPOS)[number])) {
    return { error: "Tipo de entregable no válido." };
  }
  if (!storagePath.startsWith("shared/")) {
    return { error: "Ruta de archivo no válida para carga masiva." };
  }
  if (sponsorIds.length === 0) {
    return { error: "Debes seleccionar al menos un sponsor." };
  }

  const rows = sponsorIds.map((sponsorId) => ({
    sponsor_id: sponsorId,
    direccion: "ctw_entrega" as const,
    tipo,
    nombre_archivo: filename,
    storage_path: storagePath,
    subido_por: user.id,
  }));

  const { error: insertError } = await supabase.from("archivos").insert(rows);

  if (insertError) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  for (const sponsorId of sponsorIds) {
    revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  }
  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null };
}

export async function saveBulkEntregaLink(
  sponsorIds: string[],
  eventoSlug: string,
  url: string,
  tipo: string,
) {
  const { supabase, user } = await requireAdmin();
  if (!ENTREGABLE_TIPOS.includes(tipo as (typeof ENTREGABLE_TIPOS)[number])) {
    return { error: "Tipo de entregable no válido." };
  }
  try {
    new URL(url);
  } catch {
    return { error: "La URL no es válida." };
  }
  if (sponsorIds.length === 0) {
    return { error: "Debes seleccionar al menos un sponsor." };
  }

  const rows = sponsorIds.map((sponsorId) => ({
    sponsor_id: sponsorId,
    direccion: "ctw_entrega" as const,
    tipo,
    nombre_archivo: url,
    storage_path: url,
    subido_por: user.id,
  }));

  const { error: insertError } = await supabase.from("archivos").insert(rows);
  if (insertError) return { error: insertError.message };

  for (const sponsorId of sponsorIds) {
    revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  }
  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null };
}

export async function deleteEntregasBulk(
  archivoIds: string[],
  eventoSlug: string,
) {
  if (archivoIds.length === 0) return { error: "No hay archivos que eliminar." };

  const { supabase } = await requireAdmin();

  // Read with RLS to validate admin access and collect paths
  const { data: rows, error: fetchError } = await supabase
    .from("archivos")
    .select("id, storage_path, sponsor_id")
    .in("id", archivoIds)
    .eq("direccion", "ctw_entrega");

  if (fetchError) return { error: fetchError.message };
  if (!rows || rows.length === 0) return { error: "No se encontraron los archivos." };

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("archivos")
    .delete()
    .in("id", archivoIds)
    .eq("direccion", "ctw_entrega");

  if (deleteError) return { error: deleteError.message };

  // Remove from storage only unique paths that are no longer referenced
  const uniquePaths = Array.from(new Set(rows.map((r) => r.storage_path as string)));
  for (const path of uniquePaths) {
    if (/^https?:\/\//i.test(path)) continue;
    const { count } = await admin
      .from("archivos")
      .select("id", { count: "exact", head: true })
      .eq("storage_path", path);
    if (!count) {
      await admin.storage.from(BUCKET).remove([path]);
    }
  }

  const uniqueSponsorIds = Array.from(new Set(rows.map((r) => r.sponsor_id as string)));
  for (const sponsorId of uniqueSponsorIds) {
    revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  }
  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null };
}
