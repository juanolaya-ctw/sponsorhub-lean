"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export type BeneficioActionState = {
  error: string | null;
  success?: boolean;
};

function revalidateCompromisos(eventoSlug: string, sponsorId?: string) {
  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  if (sponsorId) {
    revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  }
  revalidatePath("/portal/dashboard");
}

export async function updateCompromisoEstado(
  compromisoId: string,
  estadoId: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("compromisos")
    .update({ estado_id: estadoId })
    .eq("id", compromisoId)
    .select("sponsor_id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  revalidateCompromisos(eventoSlug, data?.sponsor_id);
  return { error: null };
}

export async function updateCompromisoFecha(
  compromisoId: string,
  fechaLimite: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("compromisos")
    .update({ fecha_limite: fechaLimite || null })
    .eq("id", compromisoId)
    .select("sponsor_id")
    .maybeSingle();

  if (error) return { error: error.message };
  revalidateCompromisos(eventoSlug, data?.sponsor_id);
  return { error: null };
}

export async function createBeneficio(
  _previous: BeneficioActionState,
  formData: FormData,
): Promise<BeneficioActionState> {
  const { supabase } = await requireAdmin();
  const eventoId = String(formData.get("evento_id") ?? "");
  const eventoSlug = String(formData.get("evento_slug") ?? "");
  const tier = String(formData.get("tier") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const beneficio = String(formData.get("beneficio") ?? "").trim();
  const cantidadRaw = String(formData.get("cantidad") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const cantidad = cantidadRaw ? Number.parseInt(cantidadRaw, 10) : null;

  if (!eventoId || !eventoSlug || !tier || !categoria || !beneficio) {
    return { error: "Categoría y beneficio son obligatorios." };
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

  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null, success: true };
}

export async function deleteBeneficio(id: string, eventoSlug: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("catalogo_beneficios")
    .delete()
    .eq("id", id);

  if (error?.code === "23503") {
    return { error: "No se puede eliminar porque ya generó compromisos." };
  }
  if (error) return { error: error.message };

  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null };
}
