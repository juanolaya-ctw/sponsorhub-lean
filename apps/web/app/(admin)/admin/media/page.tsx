import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientesCrm, type ClienteRow } from "./clientes-crm";

export default async function MediaCrmPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: clientesData, error: clientesError } = await admin
    .from("media_clientes")
    .select("id, nombre, empresa, email_contacto, activo")
    .order("nombre");

  if (clientesError) throw new Error(clientesError.message);

  const clienteIds = (clientesData ?? []).map((c) => c.id as string);

  const [cyclesResult, planesResult] = await Promise.all([
    clienteIds.length > 0
      ? admin
          .from("media_billing_cycles")
          .select(
            "id, cliente_id, plan_id, periodo, creditos_asignados, creditos_extra, creditos_rollover",
          )
          .in("cliente_id", clienteIds)
          .order("periodo", { ascending: false })
      : { data: [], error: null },
    admin
      .from("media_planes")
      .select("id, nombre")
      .eq("activo", true),
  ]);

  if (cyclesResult.error) throw new Error(cyclesResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);

  const planMap = new Map(
    (planesResult.data ?? []).map((p) => [p.id as string, p.nombre as string]),
  );

  // Latest cycle per cliente
  const latestByCliente = new Map<string, (typeof cyclesResult.data)[number]>();
  for (const cycle of cyclesResult.data ?? []) {
    const cid = cycle.cliente_id as string;
    if (!latestByCliente.has(cid)) latestByCliente.set(cid, cycle);
  }

  // Fetch used credits for latest cycles
  const latestCycleIds = Array.from(latestByCliente.values()).map(
    (c) => c.id as string,
  );
  const assetsResult =
    latestCycleIds.length > 0
      ? await admin
          .from("media_assets_ejecutados")
          .select("billing_cycle_id, costo_creditos, estado")
          .in("billing_cycle_id", latestCycleIds)
      : { data: [], error: null };

  if (assetsResult.error) throw new Error(assetsResult.error.message);

  const usadosByCiclo = new Map<string, number>();
  for (const a of assetsResult.data ?? []) {
    if (a.estado === "cancelado") continue;
    const cid = a.billing_cycle_id as string;
    usadosByCiclo.set(
      cid,
      (usadosByCiclo.get(cid) ?? 0) + (Number(a.costo_creditos) || 0),
    );
  }

  const clientes: ClienteRow[] = (clientesData ?? []).map((c) => {
    const cid = c.id as string;
    const cycle = latestByCliente.get(cid) ?? null;
    let creditosDisponibles: number | null = null;
    if (cycle) {
      const asignados = (cycle.creditos_asignados as number) || 0;
      const extra = (cycle.creditos_extra as number | null) ?? 0;
      const rollover = (cycle.creditos_rollover as number) || 0;
      const usados = usadosByCiclo.get(cycle.id as string) ?? 0;
      creditosDisponibles = asignados + extra + rollover - usados;
    }
    return {
      id: cid,
      nombre: c.nombre as string,
      empresa: (c.empresa as string | null) ?? null,
      emailContacto: (c.email_contacto as string | null) ?? null,
      activo: c.activo as boolean,
      planNombre: cycle ? (planMap.get(cycle.plan_id as string) ?? null) : null,
      creditosDisponibles,
      periodo: cycle ? (cycle.periodo as string) : null,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#42B3F3]">
          CRM
        </p>
        <h1 className="text-2xl font-semibold">Clientes Media</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pool global de clientes, todos los eventos.
        </p>
      </div>
      <ClientesCrm clientes={clientes} />
    </div>
  );
}
