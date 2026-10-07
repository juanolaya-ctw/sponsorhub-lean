import { redirect } from "next/navigation";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AprobarAssetButton } from "./aprobar-asset-button";

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

const ESTADO_LABELS: Record<AssetEstado, string> = {
  pendiente_insumos: "Pendiente insumos",
  insumos_recibidos: "Insumos recibidos",
  en_ejecucion: "En ejecución",
  entregado: "Entregado",
  aprobado: "Aprobado",
};

function formatPeriodo(periodo: string) {
  const d = new Date(`${periodo}T00:00:00`);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

export default async function PortalMediaPage() {
  const [{ supabase }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  if (!sponsor.ctMedia) {
    redirect("/portal/dashboard");
  }

  const cyclesResult = await supabase
    .from("media_billing_cycles")
    .select("id, plan_id, periodo, creditos_asignados, creditos_rollover")
    .eq("sponsor_id", sponsor.sponsorId)
    .order("periodo", { ascending: false })
    .limit(6);

  if (cyclesResult.error) throw new Error(cyclesResult.error.message);

  const cycles = cyclesResult.data ?? [];
  const currentCycle = cycles[0] ?? null;
  const currentCycleId = currentCycle?.id as string | undefined;

  const allCycleIds = cycles.map((c) => c.id as string);
  const assetsResult =
    allCycleIds.length > 0
      ? await supabase
          .from("media_assets_ejecutados")
          .select(
            "id, billing_cycle_id, asset_id, costo_creditos, estado, evidencias_url, entregado_at",
          )
          .in("billing_cycle_id", allCycleIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  if (assetsResult.error) throw new Error(assetsResult.error.message);
  const allAssets = assetsResult.data ?? [];

  // Fetch plan and catalog names via separate queries (no FK joins)
  const planIds = [...new Set(cycles.map((c) => c.plan_id as string).filter(Boolean))];
  const assetIds = [...new Set(allAssets.map((a) => a.asset_id as string).filter(Boolean))];

  const [planesResult, catalogResult] = await Promise.all([
    planIds.length > 0
      ? supabase.from("media_planes").select("id, nombre").in("id", planIds)
      : { data: [] as { id: unknown; nombre: unknown }[], error: null },
    assetIds.length > 0
      ? supabase.from("media_assets_catalogo").select("id, nombre").in("id", assetIds)
      : { data: [] as { id: unknown; nombre: unknown }[], error: null },
  ]);

  const planMap = new Map(
    (planesResult.data ?? []).map((p) => [p.id as string, p.nombre as string]),
  );
  const catalogMap = new Map(
    (catalogResult.data ?? []).map((a) => [a.id as string, a.nombre as string]),
  );

  const usadosPorCiclo = new Map<string, number>();
  for (const a of allAssets) {
    const cid = a.billing_cycle_id as string;
    usadosPorCiclo.set(
      cid,
      (usadosPorCiclo.get(cid) ?? 0) + (a.costo_creditos as number),
    );
  }

  const currentAssets = allAssets.filter(
    (a) => (a.billing_cycle_id as string) === currentCycleId,
  );

  const currentAsignados = currentCycle
    ? (currentCycle.creditos_asignados as number)
    : 0;
  const currentRollover = currentCycle
    ? (currentCycle.creditos_rollover as number)
    : 0;
  const currentUsados = currentCycleId
    ? (usadosPorCiclo.get(currentCycleId) ?? 0)
    : 0;
  const currentDisponibles = currentAsignados + currentRollover - currentUsados;
  const pct = Math.round(
    (currentUsados / (currentAsignados + currentRollover || 1)) * 100,
  );
  const reporteUrl = currentCycleId
    ? `/api/media/reporte/${currentCycleId}`
    : null;

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créditos y assets de contenido CT Media
          </p>
        </div>
        {reporteUrl ? (
          <Button asChild variant="outline">
            <a href={reporteUrl} target="_blank" rel="noreferrer">
              Descargar reporte
            </a>
          </Button>
        ) : null}
      </div>

      {!currentCycle ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Media no activado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            El equipo de ColombiaTech configurará tu plan de créditos.
          </p>
        </div>
      ) : (
        <>
          {/* Balance */}
          <section className="rounded-xl border border-border bg-white p-6">
            <p className="text-5xl font-bold">{currentDisponibles}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              créditos disponibles de {currentAsignados} asignados
              {currentRollover > 0 ? ` + ${currentRollover} de rollover` : ""}
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#42B3F3] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {pct}% usado este mes ·{" "}
              <span className="font-medium">1 crédito = $1 USD</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tus créditos se recargan el 1 de cada mes
            </p>
          </section>

          {/* Assets activos */}
          {currentAssets.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">
                Assets activos —{" "}
                <span className="capitalize text-muted-foreground">
                  {formatPeriodo(currentCycle.periodo as string)}
                </span>
              </h2>
              <div className="mt-4 space-y-3">
                {currentAssets.map((a) => {
                  const estado =
                    (a.estado as AssetEstado) ?? "pendiente_insumos";
                  const nombre = catalogMap.get(a.asset_id as string) ?? "Asset";
                  const deliveredAt = formatDate(
                    a.entregado_at as string | null,
                  );
                  return (
                    <div
                      key={a.id as string}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{nombre}</p>
                        {deliveredAt ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Entregado: {deliveredAt}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.evidencias_url ? (
                          <a
                            href={a.evidencias_url as string}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-secondary hover:underline"
                          >
                            Ver entregable
                          </a>
                        ) : null}
                        <Badge>{ESTADO_LABELS[estado]}</Badge>
                        {estado === "entregado" ? (
                          <AprobarAssetButton assetId={a.id as string} />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Timeline */}
          <section>
            <h2 className="text-xl font-semibold">Historial de créditos</h2>
            <div className="mt-4 space-y-2">
              {cycles.map((c, idx) => {
                const cid = c.id as string;
                const asignados = c.creditos_asignados as number;
                const rollover = c.creditos_rollover as number;
                const usados = usadosPorCiclo.get(cid) ?? 0;
                const disponibles = asignados + rollover - usados;
                const planNombre = planMap.get(c.plan_id as string) ?? "—";
                return (
                  <div
                    key={cid}
                    className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-white px-4 py-3 text-sm"
                  >
                    <span className="min-w-24 font-medium capitalize">
                      {formatPeriodo(c.periodo as string)}
                    </span>
                    <span className="text-muted-foreground">{planNombre}</span>
                    <span className="ml-auto flex gap-4 text-right text-xs text-muted-foreground">
                      <span>Asig. {asignados}</span>
                      {rollover > 0 ? (
                        <span>Roll. +{rollover}</span>
                      ) : null}
                      <span>Usados {usados}</span>
                      <span className="font-semibold text-foreground">
                        Disp. {disponibles}
                      </span>
                    </span>
                    {idx === 0 ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Cerrado</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
