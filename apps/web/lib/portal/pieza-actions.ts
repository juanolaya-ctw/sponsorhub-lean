"use server";

import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { piezaPath } from "@/lib/portal/soy-sponsor-pieza";
import { createAdminClient } from "@/lib/supabase/admin";

export type GuardarPiezaState = { error: string | null };

/**
 * Registra en sponsors la pieza ya subida a Storage. El sponsor no tiene
 * policy de UPDATE sobre sponsors, así que se escribe con service_role,
 * acotado al sponsor autenticado y al path canónico.
 */
export async function guardarPiezaSoySponsor(
  path: string,
): Promise<GuardarPiezaState> {
  await requireSponsor();
  const sponsor = await getSponsorContext();

  if (path !== piezaPath(sponsor.sponsorId)) {
    return { error: "Ruta de pieza inválida." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("sponsors")
    .update({ pieza_path: path, pieza_generada_at: new Date().toISOString() })
    .eq("id", sponsor.sponsorId);

  return { error: error?.message ?? null };
}
