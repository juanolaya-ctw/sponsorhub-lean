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

const TIPOS_PANEL = new Set(["Adicional", "Upgrade", "Tailor made"]);
const CATEGORIAS_PANEL = new Set([
  "Pre evento",
  "Durante evento",
  "Post evento",
]);

/**
 * Crea un beneficio personalizado en el panel (sin notion_page_id).
 * Solo tipos Adicional / Upgrade / Tailor made — Contrato viene de Notion.
 */
export async function createCompromisoSponsor(
  _previous: BeneficioActionState,
  formData: FormData,
): Promise<BeneficioActionState> {
  const { supabase } = await requireAdmin();
  const eventoSlug = String(formData.get("evento_slug") ?? "");
  const sponsorId = String(formData.get("sponsor_id") ?? "");
  const eventoId = String(formData.get("evento_id") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const tipoBeneficio = String(formData.get("tipo_beneficio") ?? "").trim();
  const categoriaBeneficio = String(
    formData.get("categoria_beneficio") ?? "",
  ).trim();

  if (!eventoSlug || !sponsorId || !eventoId || !nombre) {
    return { error: "Nombre del beneficio es obligatorio." };
  }
  if (!TIPOS_PANEL.has(tipoBeneficio)) {
    return {
      error: "Tipo inválido. Usa Adicional, Upgrade o Tailor made.",
    };
  }
  if (!CATEGORIAS_PANEL.has(categoriaBeneficio)) {
    return { error: "Categoría inválida." };
  }

  const { data: pendiente, error: estadoError } = await supabase
    .from("estados_compromiso")
    .select("id, evento_id")
    .eq("nombre", "Pendiente")
    .or(`evento_id.eq.${eventoId},evento_id.is.null`);

  if (estadoError) return { error: estadoError.message };
  const estadoId =
    pendiente?.find((row) => row.evento_id === eventoId)?.id ??
    pendiente?.find((row) => row.evento_id == null)?.id;
  if (!estadoId) {
    return { error: 'No existe el estado "Pendiente".' };
  }

  const { error } = await supabase.from("compromisos").insert({
    sponsor_id: sponsorId,
    tipo: nombre,
    tipo_beneficio: tipoBeneficio,
    categoria_beneficio: categoriaBeneficio,
    estado_id: estadoId,
    // notion_page_id queda NULL — no choca con el sync LAB
  });
  if (error) return { error: error.message };

  revalidateCompromisos(eventoSlug, sponsorId);
  return { error: null, success: true };
}

/**
 * Elimina un compromiso creado en el panel.
 * Contrato y filas con notion_page_id solo se quitan desde Notion / prune.
 */
export async function deleteCompromisoSponsor(
  compromisoId: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  const { data, error: lookupError } = await supabase
    .from("compromisos")
    .select("id, sponsor_id, tipo_beneficio, notion_page_id")
    .eq("id", compromisoId)
    .maybeSingle();

  if (lookupError || !data) {
    return { error: lookupError?.message ?? "Compromiso no encontrado." };
  }
  if (data.tipo_beneficio === "Contrato") {
    return {
      error: "Los beneficios de Contrato solo se eliminan desde Notion.",
    };
  }
  if (data.notion_page_id) {
    return {
      error:
        "Este beneficio viene de LAB Beneficios. Elimínalo en Notion; el sync lo quitará.",
    };
  }

  const { error } = await supabase
    .from("compromisos")
    .delete()
    .eq("id", compromisoId);
  if (error) return { error: error.message };

  revalidateCompromisos(eventoSlug, data.sponsor_id as string);
  return { error: null };
}
