"use server";

import { redirect } from "next/navigation";
import type { EventoEstado } from "@/lib/admin/eventos";
import { slugify } from "@/lib/admin/slugify";
import { requireAdmin } from "@/lib/auth/require-admin";

export type CrearEventoState = { error: string | null };

const ESTADOS: EventoEstado[] = ["planificacion", "activo", "cerrado"];

function isEventoEstado(value: string): value is EventoEstado {
  return ESTADOS.includes(value as EventoEstado);
}

export async function createEvento(
  _prev: CrearEventoState,
  formData: FormData,
): Promise<CrearEventoState> {
  const { supabase } = await requireAdmin();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || nombre);
  const fechaInicio = String(formData.get("fecha_inicio") ?? "").trim() || null;
  const fechaFin = String(formData.get("fecha_fin") ?? "").trim() || null;
  const estadoRaw = String(formData.get("estado") ?? "planificacion");

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }
  if (!slug) {
    return { error: "El slug es obligatorio." };
  }
  if (!isEventoEstado(estadoRaw)) {
    return { error: "Estado inválido." };
  }

  const { error } = await supabase.from("eventos").insert({
    nombre,
    slug,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado: estadoRaw,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un evento con ese slug." };
    }
    return { error: error.message };
  }

  redirect(`/admin/${slug}/sponsors`);
}
