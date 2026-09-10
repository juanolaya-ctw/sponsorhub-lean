"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export type CatalogoActionState = { error: string | null };

export async function createBeneficio(
  _previous: CatalogoActionState,
  formData: FormData,
): Promise<CatalogoActionState> {
  const { supabase } = await requireAdmin();
  const eventoId = String(formData.get("evento_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const tier = String(formData.get("tier") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const beneficio = String(formData.get("beneficio") ?? "").trim();
  const cantidadRaw = String(formData.get("cantidad") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const cantidad = cantidadRaw ? Number.parseInt(cantidadRaw, 10) : null;

  if (!eventoId || !slug || !tier || !categoria || !beneficio) {
    return { error: "Tier, categoría y beneficio son obligatorios." };
  }
  if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad < 0)) {
    return { error: "La cantidad debe ser un número positivo." };
  }

  const { error } = await supabase.from("catalogo_beneficios").insert({
    evento_id: eventoId,
    tier,
    categoria,
    beneficio,
    cantidad,
    notas,
  });

  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/catalogo`);
  return { error: null };
}

export async function deleteBeneficio(id: string, slug: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("catalogo_beneficios").delete().eq("id", id);

  if (error?.code === "23503") {
    return { error: "No se puede eliminar porque ya generó compromisos." };
  }
  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}/catalogo`);
  return { error: null };
}
