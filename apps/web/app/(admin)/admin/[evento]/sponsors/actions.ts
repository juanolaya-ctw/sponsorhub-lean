"use server";

import { revalidatePath } from "next/cache";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "sponsorhub-archivos";

function isStoredObject(path: string) {
  return !/^(?:texto|https?:)/i.test(path);
}

export async function deleteSponsor(
  sponsorId: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  const { data, error: lookupError } = await supabase
    .from("sponsors")
    .select("id, eventos!inner(slug), archivos(storage_path)")
    .eq("id", sponsorId)
    .eq("eventos.slug", eventoSlug)
    .maybeSingle();

  if (lookupError || !data) {
    return { error: lookupError?.message ?? "Sponsor no encontrado." };
  }

  const { error: deleteError } = await supabase
    .from("sponsors")
    .delete()
    .eq("id", sponsorId);
  if (deleteError) return { error: deleteError.message };

  const archivos = data.archivos as unknown as Array<{ storage_path: string }>;
  const paths = archivos
    .map((archivo) => archivo.storage_path)
    .filter(isStoredObject);
  if (paths.length > 0) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove(paths);
  }

  revalidatePath(`/admin/${eventoSlug}/sponsors`);
  return { error: null };
}

export async function updateSponsorTier(
  sponsorId: string,
  eventoSlug: string,
  tier: string,
) {
  const { evento, supabase } = await getEventoBySlug(eventoSlug);
  const { data: availableTier, error: tierError } = await supabase
    .from("catalogo_beneficios")
    .select("tier")
    .eq("evento_id", evento.id)
    .eq("tier", tier)
    .limit(1)
    .maybeSingle();

  if (tierError || !availableTier) {
    return { error: tierError?.message ?? "El tier no existe en este evento." };
  }

  const { error } = await supabase
    .from("sponsors")
    .update({ paquete: tier })
    .eq("id", sponsorId)
    .eq("evento_id", evento.id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${eventoSlug}/sponsors`);
  revalidatePath(`/admin/${eventoSlug}/sponsors/${sponsorId}`);
  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  return { error: null };
}
