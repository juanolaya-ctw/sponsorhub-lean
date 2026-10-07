"use server";

import { revalidatePath } from "next/cache";
import { requireSponsor } from "@/lib/auth/require-admin";
import {
  isStoredObject,
  loadPortalBeneficio,
  TIPO_STAND_RENDER,
  type StandDecision,
} from "@/lib/portal/beneficios";
import { getSponsorContext } from "@/lib/portal/sponsor";

export type StandActionState = { error: string | null; success?: boolean };

export async function responderStandRender(input: {
  compromisoId: string;
  decision: StandDecision;
  comentario: string;
}): Promise<StandActionState> {
  const [{ supabase, user }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  const beneficio = await loadPortalBeneficio(
    supabase,
    sponsor.sponsorId,
    input.compromisoId,
  );
  if (!beneficio || beneficio.tipo !== "stand") {
    return { error: "Beneficio de stand no encontrado." };
  }

  const renders = beneficio.archivos.filter(
    (item) =>
      item.tipo === TIPO_STAND_RENDER && isStoredObject(item.storage_path),
  );
  if (renders.length === 0) {
    return { error: "Aún no hay renders para revisar." };
  }

  if (
    beneficio.standRevision?.decision === "aprobado" &&
    input.decision === "aprobado"
  ) {
    return { error: "Este stand ya está aprobado." };
  }

  const comentario = input.comentario.trim();
  if (input.decision === "cambios_solicitados" && comentario.length < 5) {
    return {
      error: "Cuéntanos qué hay que cambiar (mínimo 5 caracteres).",
    };
  }

  const { error } = await supabase.from("stand_revisiones").insert({
    compromiso_id: input.compromisoId,
    decision: input.decision,
    comentario: comentario.length > 0 ? comentario : null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath(`/portal/recursos/${input.compromisoId}`);
  revalidatePath("/portal/recursos");
  revalidatePath("/portal/dashboard");
  return { error: null, success: true };
}
