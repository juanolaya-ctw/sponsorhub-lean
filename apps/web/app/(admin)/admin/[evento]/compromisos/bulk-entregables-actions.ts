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
