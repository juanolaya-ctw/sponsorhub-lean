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

function isStoredObject(path: string) {
  return !/^(?:texto|https?:)/i.test(path);
}

async function removeStorageIfOrphan(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
) {
  if (!isStoredObject(path)) return;
  const { count } = await admin
    .from("archivos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", path);
  if (!count) {
    await admin.storage.from(BUCKET).remove([path]);
  }
}

export async function prepareReplacementUpload(
  archivoId: string,
  sponsorId: string,
  filename: string,
) {
  const { supabase } = await requireAdmin();
  const { data: archivo, error: archivoError } = await supabase
    .from("archivos")
    .select("id, sponsor_id")
    .eq("id", archivoId)
    .eq("sponsor_id", sponsorId)
    .maybeSingle();

  if (archivoError || !archivo) {
    return { data: null, error: archivoError?.message ?? "Archivo no encontrado." };
  }

  const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) return { data: null, error: error.message };
  return { data: { path: data.path, token: data.token }, error: null };
}

export async function finalizeReplacement(
  archivoId: string,
  sponsorId: string,
  eventoSlug: string,
  replacementPath: string,
  replacementName: string,
) {
  const { supabase } = await requireAdmin();
  const { data: archivo, error: archivoError } = await supabase
    .from("archivos")
    .select("storage_path")
    .eq("id", archivoId)
    .eq("sponsor_id", sponsorId)
    .maybeSingle();

  if (archivoError || !archivo) {
    return { error: archivoError?.message ?? "Archivo no encontrado." };
  }
  if (!replacementPath.startsWith(`${sponsorId}/`)) {
    return { error: "La ruta del reemplazo no corresponde al sponsor." };
  }

  const { error: updateError } = await supabase
    .from("archivos")
    .update({
      nombre_archivo: replacementName,
      storage_path: replacementPath,
      sync_estado: "local",
    })
    .eq("id", archivoId)
    .eq("sponsor_id", sponsorId);

  const admin = createAdminClient();
  if (updateError) {
    await admin.storage.from(BUCKET).remove([replacementPath]);
    return { error: updateError.message };
  }

  await removeStorageIfOrphan(admin, archivo.storage_path);

  revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  return { error: null };
}

export async function prepareEntregaUpload(sponsorId: string, filename: string) {
  await requireAdmin();
  const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(filename)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) return { data: null, error: error.message };
  return { data: { path: data.path, token: data.token }, error: null };
}

export async function finalizeEntregaUpload(
  sponsorId: string,
  eventoSlug: string,
  storagePath: string,
  filename: string,
  tipo: string,
) {
  const { supabase, user } = await requireAdmin();
  if (!ENTREGABLE_TIPOS.includes(tipo as (typeof ENTREGABLE_TIPOS)[number])) {
    return { error: "Tipo de entregable no válido." };
  }
  if (!storagePath.startsWith(`${sponsorId}/`)) {
    return { error: "La ruta del archivo no corresponde al sponsor." };
  }

  const { error: insertError } = await supabase.from("archivos").insert({
    sponsor_id: sponsorId,
    direccion: "ctw_entrega",
    tipo,
    nombre_archivo: filename,
    storage_path: storagePath,
    subido_por: user.id,
  });

  if (insertError) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  return { error: null };
}

export async function deleteArchivo(
  archivoId: string,
  sponsorId: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  // Esta lectura pasa por RLS antes de usar service_role para el DELETE,
  // cuya policy aún no existe en sponsorhub.archivos.
  const { data: archivo, error: archivoError } = await supabase
    .from("archivos")
    .select("storage_path")
    .eq("id", archivoId)
    .eq("sponsor_id", sponsorId)
    .maybeSingle();

  if (archivoError || !archivo) {
    return { error: archivoError?.message ?? "Archivo no encontrado." };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("archivos")
    .delete()
    .eq("id", archivoId)
    .eq("sponsor_id", sponsorId);
  if (deleteError) return { error: deleteError.message };

  await removeStorageIfOrphan(admin, archivo.storage_path);

  revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  return { error: null };
}
