import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivarAssetDialog } from "./activar-asset-dialog";
import { AssetEstadoSelect } from "./asset-estado-select";
import { CerrarCicloDialog } from "./cerrar-ciclo-dialog";
import { EditarNotasDialog } from "./editar-notas-dialog";

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

function formatPeriodo(periodo: string) {
  const d = new Date(`${periodo}T00:00:00`);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

export default async function MediaDetallePage({
  params,
}: {
  params: Promise<{ evento: string; sponsorId: string }>;
}) {
  const { evento: slug, sponsorId } = await params;
  const { evento } = await getEventoBySlug(slug);
  const admin = createAdminClient();

  const [sponsorResult, cyclesResult, catalogResult, planesResult] =
    await Promise.all([
      admin
        .from("sponsors")
        .select("id, nombre")
        .eq("id", sponsorId)
        .eq("evento_id", evento.id)
        .maybeSingle(),
      admin
        .from("media_billing_cycles")
        .select("id, periodo, creditos_asignados, creditos_rollover, plan_id")
        .eq("sponsor_id", sponsorId)
        .order("periodo", { ascending: false })
        .limit(12),
      admin
        .from("media_assets_catalogo")
        .select("id, nombre, costo_creditos")
        .eq("activo", true)
        .order("nombre"),
      admin
        .from("media_planes")
        .select("id, nombre, creditos_mensuales")
        .eq("activo", true)
        .order("creditos_mensuales"),
    ]);

  if (sponsorResult.error) throw new Error(sponsorResult.error.message);
  if (!sponsorResult.data) notFound();
  if (cyclesResult.error) throw new Error(cyclesResult.error.message);
  if (catalogResult.error) throw new Error(catalogResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);

  const sponsor = sponsorResult.data;
  const cycles = cyclesResult.data ?? [];
  const currentCycle = cycles[0] ?? null;

  // Plan lookup map (no FK join needed)
  const planMap = new Map(
    (planesResult.data ?? []).map((p) => [
      p.id as string,
      { nombre: p.nombre as string, creditos_mensuales: p.creditos_mensuales as number },
    ]),
  );

  const allCycleIds = cycles.map((c) => c.id as string);

  // Fetch assets without FK join to catalog
  const assetsResult =
    allCycleIds.length > 0
      ? await admin
          .from("media_assets_ejecutados")
          .select(
            "id, billing_cycle_id, asset_id, costo_creditos, estado, notas_cs, evidencias_url, entregado_at",
          )
          .in("billing_cycle_id", allCycleIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: unknown; billing_cycle_id: unknown; asset_id: unknown; costo_creditos: unknown; estado: unknown; notas_cs: unknown; evidencias_url: unknown; entregado_at: unknown }[], error: null };

  if (assetsResult.error) throw new Error(assetsResult.error.message);
  const allAssets = assetsResult.data ?? [];

  // Catalog lookup map
  const catalogMap = new Map(
    (catalogResult.data ?? []).map((a) => [a.id as string, a.nombre as string]),
  );

  const assetsPorCiclo = new Map<string, typeof allAssets>();
  for (const asset of allAssets) {
    const cid = asset.billing_cycle_id as string;
    if (!assetsPorCiclo.has(cid)) assetsPorCiclo.set(cid, []);
    assetsPorCiclo.get(cid)!.push(asset);
  }

  const usadosPorCiclo = new Map<string, number>();
  for (const [cid, assets] of assetsPorCiclo.entries()) {
    usadosPorCiclo.set(
      cid,
      assets.reduce<number>((s, a) => s + (a.costo_creditos as number), 0),
    );
  }

  const currentCycleId = currentCycle?.id as string | undefined;
  const currentAssets = currentCycleId
    ? (assetsPorCiclo.get(currentCycleId) ?? [])
    : [];
  const currentUsados = currentCycleId
    ? (usadosPorCiclo.get(currentCycleId) ?? 0)
    : 0;
  const currentAsignados = currentCycle
    ? (currentCycle.creditos_asignados as number)
    : 0;
  const currentRollover = currentCycle
    ? (currentCycle.creditos_rollover as number)
    : 0;
  const currentDisponibles = currentAsignados + currentRollover - currentUsados;
  const currentPlanId = currentCycle?.plan_id as string | undefined;
  const currentPlan = currentPlanId ? (planMap.get(currentPlanId) ?? null) : null;

  const catalog = (catalogResult.data ?? []).map((a) => ({
    id: a.id as string,
    nombre: a.nombre as string,
    costoCreditos: a.costo_creditos as number,
  }));

  const planes = (planesResult.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    creditosMensuales: p.creditos_mensuales as number,
  }));

  // Resolve asset names via catalogMap (replaces FK join)
  const resolveAssetNombre = (assetId: unknown) =>
    catalogMap.get(assetId as string) ?? "—";

  const reporteUrl = currentCycleId
    ? `/api/media/reporte/${currentCycleId}`
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/admin/${slug}/media`}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a Media
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              {sponsor.nombre as string}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {currentPlan?.nombre ?? "Sin plan"} · Ciclo:{" "}
              {currentCycle
                ? formatPeriodo(currentCycle.periodo as string)
                : "Sin ciclos"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reporteUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={reporteUrl} target="_blank" rel="noreferrer">
                  Generar reporte
                </a>
              </Button>
            ) : null}
            {currentCycleId ? (
              <CerrarCicloDialog
                billingCycleId={currentCycleId}
                currentPlanId={currentCycle!.plan_id as string}
                planes={planes}
                disponibles={currentDisponibles}
                slug={slug}
                sponsorId={sponsorId}
              />
            ) : null}
          </div>
        </div>

        {/* Balance */}
        {currentCycle ? (
          <div className="mt-4 rounded-xl border border-border bg-white p-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Disponibles</p>
                <p className="text-2xl font-bold">{currentDisponibles}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Asignados</p>
                <p className="text-lg font-semibold">{currentAsignados}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rollover</p>
                <p className="text-lg font-semibold">{currentRollover}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usados</p>
                <p className="text-lg font-semibold">{currentUsados}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-secondary transition-[width]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (currentUsados /
                        (currentAsignados + currentRollover || 1)) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Assets del ciclo activo */}
      {currentCycleId ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Assets del ciclo actual</h2>
            <ActivarAssetDialog
              billingCycleId={currentCycleId}
              catalog={catalog}
              disponibles={currentDisponibles}
              slug={slug}
              sponsorId={sponsorId}
            />
          </div>

          {currentAssets.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No hay assets activados en este ciclo.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Evidencias</TableHead>
                    <TableHead>Entregado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAssets.map((a) => {
                    const estado =
                      (a.estado as AssetEstado) ?? "pendiente_insumos";
                    const assetNombre = resolveAssetNombre(a.asset_id);
                    return (
                      <TableRow key={a.id as string}>
                        <TableCell className="font-medium">
                          {assetNombre}
                        </TableCell>
                        <TableCell>{a.costo_creditos as number} cr.</TableCell>
                        <TableCell>
                          <AssetEstadoSelect
                            assetId={a.id as string}
                            estado={estado}
                            slug={slug}
                            sponsorId={sponsorId}
                          />
                        </TableCell>
                        <TableCell>
                          {a.evidencias_url ? (
                            <a
                              href={a.evidencias_url as string}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-secondary hover:underline"
                            >
                              Ver
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(a.entregado_at as string | null)}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditarNotasDialog
                            assetId={a.id as string}
                            assetNombre={assetNombre}
                            notasCs={(a.notas_cs as string | null) ?? ""}
                            evidenciasUrl={
                              (a.evidencias_url as string | null) ?? ""
                            }
                            slug={slug}
                            sponsorId={sponsorId}
                            estado={estado}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      {/* Timeline de ciclos */}
      <section>
        <h2 className="text-lg font-semibold">Timeline de ciclos</h2>
        {cycles.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Sin ciclos.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Asignados</TableHead>
                  <TableHead>Rollover</TableHead>
                  <TableHead>Usados</TableHead>
                  <TableHead>Disponibles</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c, idx) => {
                  const cid = c.id as string;
                  const asignados = c.creditos_asignados as number;
                  const rollover = c.creditos_rollover as number;
                  const usados = usadosPorCiclo.get(cid) ?? 0;
                  const disponibles = asignados + rollover - usados;
                  const planNombre =
                    planMap.get(c.plan_id as string)?.nombre ?? "—";
                  const esCicloActual = idx === 0;
                  return (
                    <TableRow key={cid}>
                      <TableCell className="font-medium capitalize">
                        {formatPeriodo(c.periodo as string)}
                      </TableCell>
                      <TableCell>{planNombre}</TableCell>
                      <TableCell>{asignados}</TableCell>
                      <TableCell>{rollover}</TableCell>
                      <TableCell>{usados}</TableCell>
                      <TableCell>{disponibles}</TableCell>
                      <TableCell>
                        <Badge
                          variant={esCicloActual ? "default" : "outline"}
                        >
                          {esCicloActual ? "Activo" : "Cerrado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
