"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function updateCompromisoEstado(
  compromisoId: string,
  estadoId: string,
  eventoSlug: string,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("compromisos")
    .update({ estado_id: estadoId })
    .eq("id", compromisoId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/${eventoSlug}/compromisos`);
  revalidatePath("/portal/dashboard");
  return { error: null };
}
