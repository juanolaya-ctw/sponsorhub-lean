import { cache } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export type EventoEstado = "planificacion" | "activo" | "cerrado";

export type Evento = {
  id: string;
  slug: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: EventoEstado;
};

export const getEventoBySlug = cache(async (slug: string) => {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("eventos")
    .select("id, slug, nombre, fecha_inicio, fecha_fin, estado")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return {
    evento: data as Evento,
    supabase,
  };
});
