import Link from "next/link";
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
import { ActivarMediaDialog } from "./activar-media-dialog";

type SponsorConMedia = {
  sponsorId: string;
  sponsorNombre: string;
  planNombre: string;
  periodo: string;
  creditosAsignados: number;
  creditosRollover: number;
  creditosUsados: number;
};

type SponsorSinMedia = { id: string; nombre: string };

function formatPeriodo(periodo: string) {
  const d = new Date(`${periodo}T00:00:00`);
  return d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export default async function MediaPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento } = await getEventoBySlug(slug);
  const admin = createAdminClient();

  // Fetch all sponsors for this event first, then cycles without FK joins
  const [sponsorsResult, planesResult] = await Promise.all([
    admin
      .from("sponsors")
      .select("id, nombre, ct_media")
      .eq("evento_id", evento.id)
      .order("nombre"),
    admin
      .from("media_planes")
      .select("id, nombre, creditos_mensuales")
      .eq("activo", true)
      .order("creditos_mensuales"),
  ]);

  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);

  const sponsorIds = (sponsorsResult.data ?? []).map((s) => s.id as string);
  const sponsorMap = new Map(
    (sponsorsResult.data ?? []).map((s) => [s.id as string, s.nombre as string]),
  );
  const planMap = new Map(
    (planesResult.data ?? []).map((p) => [p.id as string, p.nombre as string]),
  );

  // Only fetch cycles for sponsors in this event
  const cyclesResult =
    sponsorIds.length > 0
      ? await admin
          .from("media_billing_cycles")
          .select("id, sponsor_id, plan_id, periodo, creditos_asignados, creditos_rollover")
          .in("sponsor_id", sponsorIds)
          .order("periodo", { ascending: false })
      : { data: [], error: null };

  if (cyclesResult.error) throw new Error(cyclesResult.error.message);

  // Latest cycle per sponsor
  const latestBySponsor = new Map<string, (typeof cyclesResult.data)[number]>();
  for (const cycle of cyclesResult.data ?? []) {
    const sid = cycle.sponsor_id as string;
    if (!latestBySponsor.has(sid)) latestBySponsor.set(sid, cycle);
  }

  const latestCycleIds = Array.from(latestBySponsor.values()).map(
    (c) => c.id as string,
  );
  const usadosResult =
    latestCycleIds.length > 0
      ? await admin
          .from("media_assets_ejecutados")
          .select("billing_cycle_id, costo_creditos")
          .in("billing_cycle_id", latestCycleIds)
      : { data: [], error: null };

  if (usadosResult.error) throw new Error(usadosResult.error.message);

  const usadosPorCiclo = new Map<string, number>();
  for (const row of usadosResult.data ?? []) {
    const cid = row.billing_cycle_id as string;
    usadosPorCiclo.set(
      cid,
      (usadosPorCiclo.get(cid) ?? 0) + (row.costo_creditos as number),
    );
  }

  // Solo sponsors marcados ct_media (o con ciclo) aparecen como "con Media".
  // Ciclos huérfanos (ct_media=false) no se listan: el portal ya no los muestra.
  const ctMediaIds = new Set(
    (sponsorsResult.data ?? [])
      .filter((s) => s.ct_media === true)
      .map((s) => s.id as string),
  );

  const sponsorsConMedia: SponsorConMedia[] = Array.from(
    latestBySponsor.entries(),
  )
    .filter(([sponsorId]) => ctMediaIds.has(sponsorId))
    .map(([sponsorId, cycle]) => ({
      sponsorId,
      sponsorNombre: sponsorMap.get(sponsorId) ?? "—",
      planNombre: planMap.get(cycle.plan_id as string) ?? "—",
      periodo: cycle.periodo as string,
      creditosAsignados: cycle.creditos_asignados as number,
      creditosRollover: cycle.creditos_rollover as number,
      creditosUsados: usadosPorCiclo.get(cycle.id as string) ?? 0,
    }));

  // Sponsors con flag pero sin ciclo aún, o sin flag, pueden activarse.
  const activatedIds = new Set(
    sponsorsConMedia.map((row) => row.sponsorId),
  );
  const sponsoresSinMedia: SponsorSinMedia[] = (sponsorsResult.data ?? [])
    .filter((s) => !activatedIds.has(s.id as string))
    .map((s) => ({ id: s.id as string, nombre: s.nombre as string }));

  const planes = (planesResult.data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    creditosMensuales: p.creditos_mensuales as number,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créditos y assets CT Media por sponsor
          </p>
        </div>
        <ActivarMediaDialog
          sponsors={sponsoresSinMedia}
          planes={planes}
          slug={slug}
        />
      </div>

      {sponsorsConMedia.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Ningún sponsor tiene Media activo todavía</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa el botón &quot;+ Activar Media&quot; para comenzar.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Ciclo actual</TableHead>
                <TableHead>Créditos usados</TableHead>
                <TableHead>Disponibles</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsorsConMedia.map((row) => {
                const disponibles =
                  row.creditosAsignados +
                  row.creditosRollover -
                  row.creditosUsados;
                const pct = Math.round(
                  (row.creditosUsados /
                    (row.creditosAsignados + row.creditosRollover || 1)) *
                    100,
                );
                return (
                  <TableRow key={row.sponsorId}>
                    <TableCell className="font-medium">
                      {row.sponsorNombre}
                    </TableCell>
                    <TableCell>{row.planNombre}</TableCell>
                    <TableCell className="capitalize">
                      {formatPeriodo(row.periodo)}
                    </TableCell>
                    <TableCell>
                      {row.creditosUsados} /{" "}
                      {row.creditosAsignados + row.creditosRollover}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({pct}%)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={disponibles <= 0 ? "destructive" : "secondary"}
                      >
                        {disponibles} cr.
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/${slug}/media/${row.sponsorId}`}>
                          Ver detalle
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
