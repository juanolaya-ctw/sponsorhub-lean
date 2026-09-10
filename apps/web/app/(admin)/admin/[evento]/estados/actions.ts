"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export type EstadoActionState = { error: string | null };

export async function createEstado(
  _prev: EstadoActionState,
  formData: FormData,
): Promise<EstadoActionState> {
  const { supabase, user } = await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const eventoId = String(formData.get("evento_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  const orden = Number.parseInt(String(formData.get("orden") ?? "0"), 10);
  const esEstadoFinal = formData.get("es_estado_final") === "on";

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }
  if (!eventoId || !slug) {
    return { error: "Falta el evento." };
  }

  const { error } = await supabase.from("estados_compromiso").insert({
    evento_id: eventoId,
    nombre,
    color,
    orden: Number.isFinite(orden) ? orden : 0,
    es_estado_final: esEstadoFinal,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/${slug}/estados`);
  return { error: null };
}

export async function deleteEstado(
  id: string,
  slug: string,
): Promise<EstadoActionState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("estados_compromiso").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: hay compromisos usando este estado.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/${slug}/estados`);
  return { error: null };
}
