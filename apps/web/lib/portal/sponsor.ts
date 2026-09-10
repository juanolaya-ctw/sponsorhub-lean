import { cache } from "react";
import { redirect } from "next/navigation";
import { requireSponsor } from "@/lib/auth/require-admin";

type SponsorContext = {
  sponsorId: string;
  sponsorNombre: string;
};

export const getSponsorContext = cache(async (): Promise<SponsorContext> => {
  const { supabase, user } = await requireSponsor();
  const { data, error } = await supabase
    .from("sponsor_usuarios")
    .select("sponsor_id, sponsors(nombre)")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data?.sponsor_id) {
    redirect("/login?error=no_access");
  }

  const sponsor = data.sponsors as unknown as { nombre: string } | null;
  return {
    sponsorId: data.sponsor_id as string,
    sponsorNombre: sponsor?.nombre ?? "Sponsor",
  };
});
