"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type MediaActionState = { error: string | null; success?: boolean };

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

function firstOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function revalidateMedia(slug: string, sponsorId?: string) {
  revalidatePath(`/admin/${slug}/media`);
  if (sponsorId) revalidatePath(`/admin/${slug}/media/${sponsorId}`);
  revalidatePath(`/portal/media`);
}

export async function activarMediaSponsor(
  sponsorId: string,
  planId: string,
  slug: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: plan, error: planError } = await admin
    .from("media_planes")
    .select("id, creditos_mensuales")
    .eq("id", planId)
    .eq("activo", true)
    .maybeSingle();

  if (planError) return { error: planError.message };
  if (!plan) return { error: "Plan no encontrado." };

  const periodo = firstOfMonth(new Date());

  const { error } = await admin.from("media_billing_cycles").insert({
    sponsor_id: sponsorId,
    plan_id: planId,
    periodo,
    creditos_asignados: plan.creditos_mensuales,
    creditos_rollover: 0,
  });

  if (error) return { error: error.message };

  // Marca al sponsor como CT Media para que el portal muestre el módulo.
  const { error: flagError } = await admin
    .from("sponsors")
    .update({ ct_media: true })
    .eq("id", sponsorId);
  if (flagError) return { error: flagError.message };

  revalidateMedia(slug, sponsorId);
  revalidatePath(`/admin/${slug}/sponsors`);
  revalidatePath(`/admin/${slug}/sponsors/${sponsorId}`);
  return { error: null, success: true };
}

export async function activarAsset(
  billingCycleId: string,
  assetId: string,
  slug: string,
  sponsorId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, sponsor_id, creditos_asignados, creditos_rollover")
    .eq("id", billingCycleId)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const { data: asset, error: assetError } = await admin
    .from("media_assets_catalogo")
    .select("id, costo_creditos")
    .eq("id", assetId)
    .eq("activo", true)
    .maybeSingle();

  if (assetError) return { error: assetError.message };
  if (!asset) return { error: "Asset no encontrado." };

  const { data: usados, error: usadosError } = await admin
    .from("media_assets_ejecutados")
    .select("costo_creditos")
    .eq("billing_cycle_id", billingCycleId);

  if (usadosError) return { error: usadosError.message };

  const creditosUsados = (usados ?? []).reduce(
    (sum, row) => sum + (row.costo_creditos as number),
    0,
  );
  const disponibles =
    (cycle.creditos_asignados as number) +
    (cycle.creditos_rollover as number) -
    creditosUsados;

  if ((asset.costo_creditos as number) > disponibles) {
    return {
      error: `Saldo insuficiente. Disponibles: ${disponibles} créditos, costo: ${asset.costo_creditos as number}.`,
    };
  }

  const { error } = await admin.from("media_assets_ejecutados").insert({
    billing_cycle_id: billingCycleId,
    sponsor_id: cycle.sponsor_id,
    asset_id: assetId,
    costo_creditos: asset.costo_creditos,
  });

  if (error) return { error: error.message };

  revalidateMedia(slug, sponsorId);
  return { error: null, success: true };
}

export async function updateEstadoAsset(
  assetId: string,
  estado: AssetEstado,
  slug: string,
  sponsorId: string,
  notas_cs?: string | null,
  evidencias_url?: string | null,
  metricas?: Record<string, unknown> | null,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const patch: Record<string, unknown> = { estado };
  if (notas_cs !== undefined) patch.notas_cs = notas_cs;
  if (evidencias_url !== undefined) patch.evidencias_url = evidencias_url;
  if (metricas !== undefined) patch.metricas = metricas;
  if (estado === "entregado") patch.entregado_at = new Date().toISOString();
  if (estado === "aprobado") patch.aprobado_at = new Date().toISOString();

  const { error } = await admin
    .from("media_assets_ejecutados")
    .update(patch)
    .eq("id", assetId);

  if (error) return { error: error.message };

  revalidateMedia(slug, sponsorId);
  return { error: null, success: true };
}

export async function cerrarCiclo(
  billingCycleId: string,
  nuevoPlanId: string,
  slug: string,
  sponsorId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, sponsor_id, plan_id, periodo, creditos_asignados, creditos_rollover")
    .eq("id", billingCycleId)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const { data: usados, error: usadosError } = await admin
    .from("media_assets_ejecutados")
    .select("costo_creditos")
    .eq("billing_cycle_id", billingCycleId);

  if (usadosError) return { error: usadosError.message };

  const creditosUsados = (usados ?? []).reduce(
    (sum, row) => sum + (row.costo_creditos as number),
    0,
  );
  const disponibles =
    (cycle.creditos_asignados as number) +
    (cycle.creditos_rollover as number) -
    creditosUsados;

  const { data: nuevoPlan, error: planError } = await admin
    .from("media_planes")
    .select("id, creditos_mensuales")
    .eq("id", nuevoPlanId)
    .maybeSingle();

  if (planError) return { error: planError.message };
  if (!nuevoPlan) return { error: "Plan nuevo no encontrado." };

  const rollover = Math.min(
    Math.max(disponibles, 0),
    nuevoPlan.creditos_mensuales as number,
  );

  const periodoActual = new Date(`${cycle.periodo as string}T00:00:00`);
  const periodoSiguiente = new Date(
    periodoActual.getFullYear(),
    periodoActual.getMonth() + 1,
    1,
  );
  const nuevoPeriodo = firstOfMonth(periodoSiguiente);

  const { error } = await admin.from("media_billing_cycles").insert({
    sponsor_id: cycle.sponsor_id,
    plan_id: nuevoPlanId,
    periodo: nuevoPeriodo,
    creditos_asignados: nuevoPlan.creditos_mensuales,
    creditos_rollover: rollover,
  });

  if (error) return { error: error.message };

  revalidateMedia(slug, sponsorId);
  return { error: null, success: true };
}

export async function createCatalogAsset(
  nombre: string,
  descripcion: string | null,
  costoCreditos: number,
  slug: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("media_assets_catalogo").insert({
    nombre,
    descripcion,
    costo_creditos: costoCreditos,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}/media/catalogo`);
  return { error: null, success: true };
}

export async function updateCatalogAsset(
  id: string,
  nombre: string,
  descripcion: string | null,
  costoCreditos: number,
  slug: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_assets_catalogo")
    .update({ nombre, descripcion, costo_creditos: costoCreditos })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}/media/catalogo`);
  return { error: null, success: true };
}

export async function toggleCatalogAsset(
  id: string,
  activo: boolean,
  slug: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_assets_catalogo")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/${slug}/media/catalogo`);
  return { error: null, success: true };
}
