"use server";

import { revalidatePath } from "next/cache";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { createAdminClient } from "@/lib/supabase/admin";

export type PortalMediaActionState = { error: string | null; success?: boolean };

export async function aprobarAsset(
  assetId: string,
): Promise<PortalMediaActionState> {
  await requireSponsor();
  const sponsor = await getSponsorContext();
  const admin = createAdminClient();

  const { data: asset, error: fetchError } = await admin
    .from("media_assets_ejecutados")
    .select("id, sponsor_id, estado")
    .eq("id", assetId)
    .eq("sponsor_id", sponsor.sponsorId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!asset) return { error: "Asset no encontrado." };
  if ((asset.estado as string) !== "entregado")
    return { error: "Solo se pueden aprobar assets entregados." };

  const { error } = await admin
    .from("media_assets_ejecutados")
    .update({ estado: "aprobado", aprobado_at: new Date().toISOString() })
    .eq("id", assetId);

  if (error) return { error: error.message };

  revalidatePath("/portal/media");
  return { error: null, success: true };
}
