"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export type CompromisoActionState = {
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

export async function createCompromiso(
  _previous: CompromisoActionState,
  formData: FormData,
): Promise<CompromisoActionState> {
  const { supabase } = await requireAdmin();
  const eventoId = String(formData.get("evento_id") ?? "");
  const eventoSlug = String(formData.get("evento_slug") ?? "");
  const sponsorId = String(formData.get("sponsor_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "").trim();
  const estadoId = String(formData.get("estado_id") ?? "");
  const fechaLimite = String(formData.get("fecha_limite") ?? "") || null;

  if (!eventoId || !eventoSlug || !sponsorId || !tipo || !estadoId) {
    return { error: "Sponsor, beneficio y estado son obligatorios." };
  }

  const [sponsorResult, estadoResult] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id")
      .eq("id", sponsorId)
      .eq("evento_id", eventoId)
      .maybeSingle(),
    supabase
      .from("estados_compromiso")
      .select("id")
      .eq("id", estadoId)
      .or(`evento_id.eq.${eventoId},evento_id.is.null`)
      .maybeSingle(),
  ]);

  if (!sponsorResult.data || !estadoResult.data) {
    return { error: "El sponsor o el estado no pertenece al evento." };
  }

  const { error } = await supabase.from("compromisos").insert({
    sponsor_id: sponsorId,
    tipo,
    estado_id: estadoId,
    fecha_limite: fechaLimite,
  });
  if (error) return { error: error.message };

  revalidateCompromisos(eventoSlug, sponsorId);
  return { error: null, success: true };
}
