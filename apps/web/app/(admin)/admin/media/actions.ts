"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type MediaActionState = { error: string | null; success?: boolean };
export type MediaActionStateWithId = MediaActionState & { clienteId?: string };

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

function firstOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function revalidateMedia(clienteId?: string) {
  revalidatePath("/admin/media");
  if (clienteId) revalidatePath(`/admin/media/${clienteId}`);
  revalidatePath("/portal/media");
}

// ── Clientes ────────────────────────────────────────────────────────────────

export async function crearClienteMedia(
  formData: FormData,
): Promise<MediaActionStateWithId> {
  await requireAdmin();
  const admin = createAdminClient();

  const nombre = (formData.get("nombre") as string | null)?.trim() ?? "";
  const empresa = (formData.get("empresa") as string | null)?.trim() || null;
  const emailContacto =
    (formData.get("email_contacto") as string | null)?.trim() || null;
  const telefono =
    (formData.get("telefono") as string | null)?.trim() || null;
  const notas = (formData.get("notas") as string | null)?.trim() || null;
  const sponsorId =
    (formData.get("sponsor_id") as string | null)?.trim() || null;

  if (!nombre) return { error: "El nombre es requerido." };

  const { data, error } = await admin
    .from("media_clientes")
    .insert({
      nombre,
      empresa,
      email_contacto: emailContacto,
      telefono,
      notas,
      sponsor_id: sponsorId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidateMedia();
  return { error: null, clienteId: (data as { id: string }).id };
}

export async function toggleClienteMedia(
  clienteId: string,
  activo: boolean,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_clientes")
    .update({ activo })
    .eq("id", clienteId);

  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function eliminarClienteMedia(
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: cycles, error: cyclesError } = await admin
    .from("media_billing_cycles")
    .select("id")
    .eq("cliente_id", clienteId);

  if (cyclesError) return { error: cyclesError.message };

  const cycleIds = (cycles ?? []).map((c) => c.id as string);

  if (cycleIds.length > 0) {
    const { error: assetsError } = await admin
      .from("media_assets_ejecutados")
      .delete()
      .in("billing_cycle_id", cycleIds);
    if (assetsError) return { error: assetsError.message };

    const { error: topupsError } = await admin
      .from("media_ciclo_topups")
      .delete()
      .in("ciclo_id", cycleIds);
    if (topupsError) return { error: topupsError.message };

    const { error: deleteCyclesError } = await admin
      .from("media_billing_cycles")
      .delete()
      .eq("cliente_id", clienteId);
    if (deleteCyclesError) return { error: deleteCyclesError.message };
  }

  const { error } = await admin
    .from("media_clientes")
    .delete()
    .eq("id", clienteId);

  if (error) return { error: error.message };

  revalidatePath("/admin/media");
  return { error: null, success: true };
}

// ── Ciclos ───────────────────────────────────────────────────────────────────

export async function activarMediaCliente(
  clienteId: string,
  planId: string,
  creditosAsignados?: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const [planResult, clienteResult] = await Promise.all([
    admin
      .from("media_planes")
      .select("id, creditos_mensuales")
      .eq("id", planId)
      .eq("activo", true)
      .maybeSingle(),
    admin
      .from("media_clientes")
      .select("sponsor_id")
      .eq("id", clienteId)
      .maybeSingle(),
  ]);

  if (planResult.error) return { error: planResult.error.message };
  if (!planResult.data) return { error: "Plan no encontrado." };

  const base = planResult.data.creditos_mensuales as number;
  const asignados =
    typeof creditosAsignados === "number" &&
    Number.isFinite(creditosAsignados) &&
    creditosAsignados > 0
      ? Math.round(creditosAsignados)
      : base;

  const periodo = firstOfMonth(new Date());
  const insert: Record<string, unknown> = {
    cliente_id: clienteId,
    plan_id: planId,
    periodo,
    creditos_asignados: asignados,
    creditos_rollover: 0,
  };
  if (clienteResult.data?.sponsor_id) {
    insert.sponsor_id = clienteResult.data.sponsor_id;
  }

  const { error } = await admin.from("media_billing_cycles").insert(insert);
  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function actualizarCreditosCiclo(
  billingCycleId: string,
  creditosAsignados: number,
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  if (!Number.isFinite(creditosAsignados) || creditosAsignados <= 0) {
    return { error: "Los créditos deben ser un número mayor a 0." };
  }

  const { error } = await admin
    .from("media_billing_cycles")
    .update({ creditos_asignados: Math.round(creditosAsignados) })
    .eq("id", billingCycleId);

  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function cerrarCicloCliente(
  billingCycleId: string,
  nuevoPlanId: string,
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select(
      "id, cliente_id, sponsor_id, periodo, creditos_asignados, creditos_extra, creditos_rollover",
    )
    .eq("id", billingCycleId)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const [usadosResult, planResult] = await Promise.all([
    admin
      .from("media_assets_ejecutados")
      .select("costo_creditos, estado")
      .eq("billing_cycle_id", billingCycleId),
    admin
      .from("media_planes")
      .select("id, creditos_mensuales")
      .eq("id", nuevoPlanId)
      .maybeSingle(),
  ]);

  if (usadosResult.error) return { error: usadosResult.error.message };
  if (planResult.error) return { error: planResult.error.message };
  if (!planResult.data) return { error: "Plan nuevo no encontrado." };

  const creditosUsados = (usadosResult.data ?? [])
    .filter((a) => a.estado !== "cancelado")
    .reduce((s: number, a) => s + (Number(a.costo_creditos) || 0), 0);

  const asignados = (cycle.creditos_asignados as number) || 0;
  const extra = (cycle.creditos_extra as number | null) ?? 0;
  const rollover = (cycle.creditos_rollover as number) || 0;
  const disponibles = asignados + extra + rollover - creditosUsados;

  const nuevoRollover = Math.min(
    Math.max(disponibles, 0),
    planResult.data.creditos_mensuales as number,
  );

  const periodoActual = new Date(`${cycle.periodo as string}T00:00:00`);
  const nuevoPeriodo = firstOfMonth(
    new Date(
      periodoActual.getFullYear(),
      periodoActual.getMonth() + 1,
      1,
    ),
  );

  const insert: Record<string, unknown> = {
    cliente_id: cycle.cliente_id,
    plan_id: nuevoPlanId,
    periodo: nuevoPeriodo,
    creditos_asignados: planResult.data.creditos_mensuales,
    creditos_rollover: nuevoRollover,
  };
  if (cycle.sponsor_id) insert.sponsor_id = cycle.sponsor_id;

  const { error } = await admin.from("media_billing_cycles").insert(insert);
  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

// ── Top-ups ──────────────────────────────────────────────────────────────────

export async function agregarTopup(
  cicloId: string,
  creditos: number,
  motivo: string,
  clienteId: string,
): Promise<MediaActionState> {
  const { user } = await requireAdmin();
  const admin = createAdminClient();

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, creditos_extra")
    .eq("id", cicloId)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const currentExtra = (cycle.creditos_extra as number | null) ?? 0;

  const [topupResult, updateResult] = await Promise.all([
    admin.from("media_ciclo_topups").insert({
      ciclo_id: cicloId,
      creditos,
      motivo,
      creado_por: user.email,
    }),
    admin
      .from("media_billing_cycles")
      .update({ creditos_extra: currentExtra + creditos })
      .eq("id", cicloId),
  ]);

  if (topupResult.error) return { error: topupResult.error.message };
  if (updateResult.error) return { error: updateResult.error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function editarTopup(
  topupId: string,
  creditos: number,
  motivo: string,
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  if (!Number.isFinite(creditos) || creditos <= 0) {
    return { error: "Los créditos deben ser un número mayor a 0." };
  }
  if (!motivo.trim()) return { error: "El motivo es requerido." };

  const { data: topup, error: topupError } = await admin
    .from("media_ciclo_topups")
    .select("id, ciclo_id, creditos")
    .eq("id", topupId)
    .maybeSingle();

  if (topupError) return { error: topupError.message };
  if (!topup) return { error: "Top-up no encontrado." };

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, creditos_extra")
    .eq("id", topup.ciclo_id as string)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const prev = (topup.creditos as number) || 0;
  const next = Math.round(creditos);
  const currentExtra = (cycle.creditos_extra as number | null) ?? 0;
  const newExtra = currentExtra - prev + next;
  if (newExtra < 0) {
    return { error: "El ajuste dejaría el top-up total en negativo." };
  }

  const [updateTopup, updateCycle] = await Promise.all([
    admin
      .from("media_ciclo_topups")
      .update({ creditos: next, motivo: motivo.trim() })
      .eq("id", topupId),
    admin
      .from("media_billing_cycles")
      .update({ creditos_extra: newExtra })
      .eq("id", cycle.id as string),
  ]);

  if (updateTopup.error) return { error: updateTopup.error.message };
  if (updateCycle.error) return { error: updateCycle.error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function eliminarTopup(
  topupId: string,
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: topup, error: topupError } = await admin
    .from("media_ciclo_topups")
    .select("id, ciclo_id, creditos")
    .eq("id", topupId)
    .maybeSingle();

  if (topupError) return { error: topupError.message };
  if (!topup) return { error: "Top-up no encontrado." };

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, creditos_extra")
    .eq("id", topup.ciclo_id as string)
    .maybeSingle();

  if (cycleError) return { error: cycleError.message };
  if (!cycle) return { error: "Ciclo no encontrado." };

  const prev = (topup.creditos as number) || 0;
  const currentExtra = (cycle.creditos_extra as number | null) ?? 0;
  const newExtra = Math.max(0, currentExtra - prev);

  const { error: deleteError } = await admin
    .from("media_ciclo_topups")
    .delete()
    .eq("id", topupId);
  if (deleteError) return { error: deleteError.message };

  const { error: updateError } = await admin
    .from("media_billing_cycles")
    .update({ creditos_extra: newExtra })
    .eq("id", cycle.id as string);
  if (updateError) return { error: updateError.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

// ── Assets ejecutados ────────────────────────────────────────────────────────

export async function activarAssetCliente(
  billingCycleId: string,
  assetId: string,
  clienteId: string,
  eventoId?: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const [cycleResult, assetResult] = await Promise.all([
    admin
      .from("media_billing_cycles")
      .select("id, cliente_id, sponsor_id, creditos_asignados, creditos_extra, creditos_rollover")
      .eq("id", billingCycleId)
      .maybeSingle(),
    admin
      .from("media_assets_catalogo")
      .select("id, costo_creditos")
      .eq("id", assetId)
      .eq("activo", true)
      .maybeSingle(),
  ]);

  if (cycleResult.error) return { error: cycleResult.error.message };
  if (!cycleResult.data) return { error: "Ciclo no encontrado." };
  if (assetResult.error) return { error: assetResult.error.message };
  if (!assetResult.data) return { error: "Asset no encontrado." };

  const { data: usados, error: usadosError } = await admin
    .from("media_assets_ejecutados")
    .select("costo_creditos, estado")
    .eq("billing_cycle_id", billingCycleId);

  if (usadosError) return { error: usadosError.message };

  const creditosUsados = (usados ?? [])
    .filter((a) => a.estado !== "cancelado")
    .reduce((s: number, a) => s + (Number(a.costo_creditos) || 0), 0);

  const cycle = cycleResult.data;
  const asignados = (cycle.creditos_asignados as number) || 0;
  const extra = (cycle.creditos_extra as number | null) ?? 0;
  const rollover = (cycle.creditos_rollover as number) || 0;
  const disponibles = asignados + extra + rollover - creditosUsados;
  const costo = assetResult.data.costo_creditos as number;

  if (costo > disponibles) {
    return {
      error: `Saldo insuficiente. Disponibles: ${disponibles} cr., costo: ${costo}.`,
    };
  }

  const insert: Record<string, unknown> = {
    billing_cycle_id: billingCycleId,
    asset_id: assetId,
    costo_creditos: costo,
  };
  if (cycle.sponsor_id) insert.sponsor_id = cycle.sponsor_id;
  if (eventoId) insert.evento_id = eventoId;

  const { error } = await admin.from("media_assets_ejecutados").insert(insert);
  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function actualizarEstadoAsset(
  assetId: string,
  estado: AssetEstado,
  clienteId: string,
  notas_cs?: string | null,
  evidencias_url?: string | null,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const patch: Record<string, unknown> = { estado };
  if (notas_cs !== undefined) patch.notas_cs = notas_cs;
  if (evidencias_url !== undefined) patch.evidencias_url = evidencias_url;
  if (estado === "entregado") patch.entregado_at = new Date().toISOString();
  if (estado === "aprobado") patch.aprobado_at = new Date().toISOString();

  const { error } = await admin
    .from("media_assets_ejecutados")
    .update(patch)
    .eq("id", assetId);

  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

export async function eliminarAssetEjecutado(
  assetId: string,
  clienteId: string,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_assets_ejecutados")
    .delete()
    .eq("id", assetId);

  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}

// ── Catálogo (global) ────────────────────────────────────────────────────────

export async function createCatalogAsset(
  nombre: string,
  descripcion: string | null,
  costoCreditos: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("media_assets_catalogo").insert({
    nombre,
    descripcion,
    costo_creditos: costoCreditos,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/media/catalogo");
  return { error: null, success: true };
}

export async function updateCatalogAsset(
  id: string,
  nombre: string,
  descripcion: string | null,
  costoCreditos: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_assets_catalogo")
    .update({ nombre, descripcion, costo_creditos: costoCreditos })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/media/catalogo");
  return { error: null, success: true };
}

export async function toggleCatalogAsset(
  id: string,
  activo: boolean,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_assets_catalogo")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/media/catalogo");
  return { error: null, success: true };
}

// ── Planes ───────────────────────────────────────────────────────────────────

export async function crearPlan(
  nombre: string,
  creditosMensuales: number,
  precioUsd: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from("media_planes").insert({
    nombre,
    creditos_mensuales: creditosMensuales,
    precio_usd: precioUsd,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/media/planes");
  return { error: null, success: true };
}

export async function actualizarPlan(
  id: string,
  nombre: string,
  creditosMensuales: number,
  precioUsd: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_planes")
    .update({ nombre, creditos_mensuales: creditosMensuales, precio_usd: precioUsd })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/media/planes");
  return { error: null, success: true };
}

export async function togglePlan(
  id: string,
  activo: boolean,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("media_planes")
    .update({ activo })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/media/planes");
  return { error: null, success: true };
}

export async function cambiarPlanCiclo(
  billingCycleId: string,
  nuevoPlanId: string,
  clienteId: string,
  creditosAsignados?: number,
): Promise<MediaActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: plan, error: planError } = await admin
    .from("media_planes")
    .select("creditos_mensuales")
    .eq("id", nuevoPlanId)
    .eq("activo", true)
    .maybeSingle();

  if (planError) return { error: planError.message };
  if (!plan) return { error: "Plan no encontrado." };

  const base = plan.creditos_mensuales as number;
  const asignados =
    typeof creditosAsignados === "number" &&
    Number.isFinite(creditosAsignados) &&
    creditosAsignados > 0
      ? Math.round(creditosAsignados)
      : base;

  const { error } = await admin
    .from("media_billing_cycles")
    .update({
      plan_id: nuevoPlanId,
      creditos_asignados: asignados,
    })
    .eq("id", billingCycleId);

  if (error) return { error: error.message };

  revalidateMedia(clienteId);
  return { error: null, success: true };
}
