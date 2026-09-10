"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function resolverAlerta(id: string, slug: string) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("alertas_sync")
    .update({
      resuelta: true,
      resuelta_por: user.id,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("resuelta", false);

  if (error) return { error: error.message };
  revalidatePath(`/admin/${slug}/alertas`);
  return { error: null };
}
