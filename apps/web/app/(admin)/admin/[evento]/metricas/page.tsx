import { BarChart2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { tipoFormulario } from "@/lib/portal/beneficios";
import { INSUMOS_REQUERIDOS, insumoKeyFromTipo } from "@/lib/portal/insumos";
import {
  getPortalPageviewsLast7Days,
  postHogAppHost,
  type PageviewPoint,
} from "@/lib/posthog/trends";
import {
  MetricasClient,
  type AccesoMetricasRow,
} from "./metricas-client";

const TOTAL_INSUMOS_REQUERIDOS = INSUMOS_REQUERIDOS.length;

type SponsorRow = {
  id: string;
  nombre: string;
  paquete: string | null;
};

type CatalogoNested = {
  cantidad: number | null;
  categoria: string | null;
  beneficio: string | null;
} | null;

type CompromisoRow = {
  id: string;
  sponsor_id: string;
  tipo: string;
  categoria_beneficio: string | null;
  catalogo_beneficios: CatalogoNested | CatalogoNested[];
  estados_compromiso: { es_estado_final: boolean } | null;
};

type CatalogoAccesoRow = {
  tier: string;
  categoria: string;
  beneficio: string;
  cantidad: number | null;
};

type ArchivoRow = {
  sponsor_id: string;
  tipo: string;
  created_at: string;
};

type AccesoDbRow = {
  id: string;
  sponsor_id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  documento_identidad: string | null;
  linkedin_url: string | null;
  rol_ecosistema: string | null;
  numero_celular: string | null;
  pais_residencia: string | null;
  empresa: string | null;
  industria: string | null;
  nivel_cargo: string | null;
  cargo: string | null;
  tipo: string;
  created_at: string;
};

function esSponsorPlaceholder(sponsor: SponsorRow): boolean {
  return sponsor.nombre.trim().toLowerCase().startsWith("backlog");
}

function oneNested<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Extrae cupo desde nombres tipo "12 Accesos Generales" o "Accesos VIP (5)". */
function parseCantidadFromNombre(nombre: string): number | null {
  const trimmed = nombre.trim();
  if (!trimmed) return null;
  const match =
    trimmed.match(/^(\d+)\b/) ??
    trimmed.match(/\bx\s*(\d+)\b/i) ??
    trimmed.match(/\((\d+)\)/);
  const raw = match?.[1];
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function esBeneficioAccesos(categoria: string | null, nombre: string): boolean {
  if (categoria && tipoFormulario(categoria) === "accesos") return true;
  return tipoFormulario(nombre) === "accesos";
}

function cupoDesdeCompromiso(compromiso: CompromisoRow): number {
  const catalogo = oneNested(compromiso.catalogo_beneficios);
  const categoria = catalogo?.categoria ?? compromiso.categoria_beneficio;
  const nombre = catalogo?.beneficio ?? compromiso.tipo;
  if (!esBeneficioAccesos(categoria, nombre)) return 0;

  if (catalogo?.cantidad != null && catalogo.cantidad > 0) {
    return catalogo.cantidad;
  }
  return parseCantidadFromNombre(nombre) ?? 0;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function TrendBars({ data }: { data: PageviewPoint[] }) {
  const max = Math.max(1, ...data.map((point) => point.count));
  return (
    <ul className="mt-4 space-y-2">
      {data.map((point) => (
        <li key={point.date} className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-muted-foreground">
            {formatShortDate(point.date)}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-secondary"
              style={{
                width: `${Math.max(4, Math.round((point.count / max) * 100))}%`,
              }}
            />
          </span>
          <span className="w-10 shrink-0 text-right font-medium">
            {point.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {sublabel ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      ) : null}
    </div>
  );
}

export default async function MetricasPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const [sponsorsResult, catalogoResult, pageviews] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, nombre, paquete")
      .eq("evento_id", evento.id)
      .order("nombre"),
    supabase
      .from("catalogo_beneficios")
      .select("tier, categoria, beneficio, cantidad")
      .eq("evento_id", evento.id),
    getPortalPageviewsLast7Days(),
  ]);

  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);
  if (catalogoResult.error) throw new Error(catalogoResult.error.message);

  const todosSponsors = (sponsorsResult.data ?? []) as SponsorRow[];
  const sponsorsActivos = todosSponsors.filter(
    (sponsor) => !esSponsorPlaceholder(sponsor),
  );
  const sponsorIds = sponsorsActivos.map((sponsor) => sponsor.id);
  const sponsorById = new Map(
    sponsorsActivos.map((sponsor) => [sponsor.id, sponsor]),
  );
  const catalogoAccesos = (
    (catalogoResult.data ?? []) as CatalogoAccesoRow[]
  ).filter((row) => esBeneficioAccesos(row.categoria, row.beneficio));

  const cupoCatalogoPorTier = new Map<string, number>();
  for (const row of catalogoAccesos) {
    const qty =
      row.cantidad != null && row.cantidad > 0
        ? row.cantidad
        : (parseCantidadFromNombre(row.beneficio) ?? 0);
    if (qty <= 0) continue;
    cupoCatalogoPorTier.set(
      row.tier,
      (cupoCatalogoPorTier.get(row.tier) ?? 0) + qty,
    );
  }

  let compromisos: CompromisoRow[] = [];
  let archivos: ArchivoRow[] = [];
  let accesosDb: AccesoDbRow[] = [];

  if (sponsorIds.length > 0) {
    const [compromisosResult, archivosResult, accesosResult] =
      await Promise.all([
        supabase
          .from("compromisos")
          .select(
            "id, sponsor_id, tipo, categoria_beneficio, catalogo_beneficios(cantidad, categoria, beneficio), estados_compromiso(es_estado_final)",
          )
          .in("sponsor_id", sponsorIds),
        supabase
          .from("archivos")
          .select("sponsor_id, tipo, created_at")
          .eq("direccion", "sponsor_sube")
          .in("sponsor_id", sponsorIds),
        supabase
          .from("accesos_personas")
          .select(
            "id, sponsor_id, nombre, apellido, email, documento_identidad, linkedin_url, rol_ecosistema, numero_celular, pais_residencia, empresa, industria, nivel_cargo, cargo, tipo, created_at",
          )
          .in("sponsor_id", sponsorIds)
          .order("created_at"),
      ]);

    if (compromisosResult.error) {
      throw new Error(compromisosResult.error.message);
    }
    if (archivosResult.error) throw new Error(archivosResult.error.message);
    if (accesosResult.error) throw new Error(accesosResult.error.message);

    compromisos = (compromisosResult.data ??
      []) as unknown as CompromisoRow[];
    archivos = (archivosResult.data ?? []) as ArchivoRow[];
    accesosDb = (accesosResult.data ?? []) as AccesoDbRow[];
  }

  const compromisosPorSponsor = new Map<
    string,
    { total: number; completados: number }
  >();
  for (const compromiso of compromisos) {
    const current = compromisosPorSponsor.get(compromiso.sponsor_id) ?? {
      total: 0,
      completados: 0,
    };
    current.total += 1;
    if (compromiso.estados_compromiso?.es_estado_final) {
      current.completados += 1;
    }
    compromisosPorSponsor.set(compromiso.sponsor_id, current);
  }

  const insumosPorSponsor = new Map<string, Set<string>>();
  const ultimaActividadPorSponsor = new Map<string, string>();
  for (const archivo of archivos) {
    const key = insumoKeyFromTipo(archivo.tipo) ?? archivo.tipo;
    const set = insumosPorSponsor.get(archivo.sponsor_id) ?? new Set<string>();
    set.add(key);
    insumosPorSponsor.set(archivo.sponsor_id, set);

    const actual = ultimaActividadPorSponsor.get(archivo.sponsor_id);
    if (!actual || new Date(archivo.created_at) > new Date(actual)) {
      ultimaActividadPorSponsor.set(archivo.sponsor_id, archivo.created_at);
    }
  }

  const accesosPorSponsor = new Map<string, number>();
  for (const acceso of accesosDb) {
    accesosPorSponsor.set(
      acceso.sponsor_id,
      (accesosPorSponsor.get(acceso.sponsor_id) ?? 0) + 1,
    );
  }

  const cupoCompromisosPorSponsor = new Map<string, number>();
  for (const compromiso of compromisos) {
    const cupo = cupoDesdeCompromiso(compromiso);
    if (cupo <= 0) continue;
    cupoCompromisosPorSponsor.set(
      compromiso.sponsor_id,
      (cupoCompromisosPorSponsor.get(compromiso.sponsor_id) ?? 0) + cupo,
    );
  }

  const accesos: AccesoMetricasRow[] = accesosDb
    .map((acceso) => {
      const sponsor = sponsorById.get(acceso.sponsor_id);
      if (!sponsor) return null;
      return {
        id: acceso.id,
        sponsor_id: acceso.sponsor_id,
        sponsor_nombre: sponsor.nombre,
        sponsor_paquete: sponsor.paquete,
        nombre: acceso.nombre,
        apellido: acceso.apellido,
        email: acceso.email,
        documento_identidad: acceso.documento_identidad,
        linkedin_url: acceso.linkedin_url,
        rol_ecosistema: acceso.rol_ecosistema,
        numero_celular: acceso.numero_celular,
        pais_residencia: acceso.pais_residencia,
        empresa: acceso.empresa,
        industria: acceso.industria,
        nivel_cargo: acceso.nivel_cargo,
        cargo: acceso.cargo,
        tipo: acceso.tipo,
        created_at: acceso.created_at,
      };
    })
    .filter((row): row is AccesoMetricasRow => row !== null)
    .sort((a, b) => {
      const bySponsor = a.sponsor_nombre.localeCompare(b.sponsor_nombre, "es");
      if (bySponsor !== 0) return bySponsor;
      return a.created_at.localeCompare(b.created_at);
    });

  const totalCompromisos = compromisos.length;
  const totalCompletados = compromisos.filter(
    (compromiso) => compromiso.estados_compromiso?.es_estado_final,
  ).length;
  const pctCumplimiento =
    totalCompromisos === 0
      ? 0
      : Math.round((totalCompletados / totalCompromisos) * 100);

  const pctInsumosPorSponsor = sponsorsActivos.map((sponsor) => {
    const subidos = insumosPorSponsor.get(sponsor.id)?.size ?? 0;
    return Math.min(
      100,
      Math.round((subidos / TOTAL_INSUMOS_REQUERIDOS) * 100),
    );
  });
  const pctInsumosPromedio =
    pctInsumosPorSponsor.length === 0
      ? 0
      : Math.round(
          pctInsumosPorSponsor.reduce((sum, pct) => sum + pct, 0) /
            pctInsumosPorSponsor.length,
        );

  const totalAccesos = accesos.length;

  const filas = sponsorsActivos
    .map((sponsor) => {
      const compromisosSponsor = compromisosPorSponsor.get(sponsor.id) ?? {
        total: 0,
        completados: 0,
      };
      const subidos = insumosPorSponsor.get(sponsor.id)?.size ?? 0;
      const pctInsumos = Math.min(
        100,
        Math.round((subidos / TOTAL_INSUMOS_REQUERIDOS) * 100),
      );
      const cupoDesdeCompromisos =
        cupoCompromisosPorSponsor.get(sponsor.id) ?? 0;
      const cupoDesdeCatalogo = sponsor.paquete
        ? (cupoCatalogoPorTier.get(sponsor.paquete) ?? 0)
        : 0;
      const accesosTotales =
        cupoDesdeCompromisos > 0 ? cupoDesdeCompromisos : cupoDesdeCatalogo;
      return {
        id: sponsor.id,
        nombre: sponsor.nombre,
        paquete: sponsor.paquete,
        compromisosCompletados: compromisosSponsor.completados,
        compromisosTotal: compromisosSponsor.total,
        pctInsumos,
        personasRegistradas: accesosPorSponsor.get(sponsor.id) ?? 0,
        accesosTotales,
        ultimaActividad: ultimaActividadPorSponsor.get(sponsor.id) ?? null,
      };
    })
    .sort((a, b) => b.pctInsumos - a.pctInsumos);

  const resumen = (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Sponsors activos"
          value={String(sponsorsActivos.length)}
        />
        <StatCard
          label="Cumplimiento de beneficios"
          value={`${pctCumplimiento}%`}
          sublabel={`${totalCompletados}/${totalCompromisos} compromisos completados`}
        />
        <StatCard
          label="Entrega de insumos"
          value={`${pctInsumosPromedio}%`}
          sublabel={`Promedio sobre ${TOTAL_INSUMOS_REQUERIDOS} insumos requeridos`}
        />
        <StatCard
          label="Accesos registrados"
          value={String(totalAccesos)}
          sublabel="Personas registradas en total"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Sponsors</h2>
        {filas.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
            <p className="font-medium">No hay sponsors activos para mostrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Los sponsors &quot;Backlog&quot; se excluyen de estas métricas.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Tier / paquete</TableHead>
                  <TableHead>Compromisos completados</TableHead>
                  <TableHead>% insumos entregados</TableHead>
                  <TableHead>Personas registradas</TableHead>
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell className="font-medium">{fila.nombre}</TableCell>
                    <TableCell>{fila.paquete ?? "—"}</TableCell>
                    <TableCell>
                      {fila.compromisosTotal === 0
                        ? "—"
                        : `${fila.compromisosCompletados}/${fila.compromisosTotal}`}
                    </TableCell>
                    <TableCell>{fila.pctInsumos}%</TableCell>
                    <TableCell>
                      {fila.accesosTotales > 0
                        ? `${fila.personasRegistradas}/${fila.accesosTotales}`
                        : String(fila.personasRegistradas)}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(fila.ultimaActividad)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Tráfico</h2>
        <div className="mt-4 rounded-xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <BarChart2
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="font-medium">Ver analytics en PostHog</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sesiones diarias, bounce rate y canales de adquisición del
                  portal.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={postHogAppHost()} target="_blank" rel="noreferrer">
                Abrir PostHog
              </a>
            </Button>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-medium">
              Pageviews del portal · últimos 7 días
            </p>
            {pageviews && pageviews.length > 0 ? (
              <TrendBars data={pageviews} />
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Sin datos disponibles todavía. Configura
                POSTHOG_PERSONAL_API_KEY y POSTHOG_PROJECT_ID para ver esta
                serie.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de cumplimiento y actividad de los sponsors de{" "}
          {evento.nombre}. Excluye sponsors &quot;Backlog&quot;.
        </p>
      </div>

      <MetricasClient
        resumen={resumen}
        accesos={accesos}
        eventoNombre={evento.nombre}
        accesosCount={totalAccesos}
      />
    </div>
  );
}
