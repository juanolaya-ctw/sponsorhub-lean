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
import { INSUMOS_REQUERIDOS, insumoKeyFromTipo } from "@/lib/portal/insumos";

const TOTAL_INSUMOS_REQUERIDOS = INSUMOS_REQUERIDOS.length;

type SponsorRow = {
  id: string;
  nombre: string;
  paquete: string | null;
  contacto_email: string | null;
};

type CompromisoRow = {
  id: string;
  sponsor_id: string;
  estados_compromiso: { es_estado_final: boolean } | null;
};

type ArchivoRow = {
  sponsor_id: string;
  tipo: string;
  created_at: string;
};

type AccesoRow = {
  sponsor_id: string;
};

function esSponsorPlaceholder(sponsor: SponsorRow): boolean {
  return (
    sponsor.nombre.trim().toLowerCase().startsWith("backlog") ||
    !sponsor.contacto_email
  );
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

  const sponsorsResult = await supabase
    .from("sponsors")
    .select("id, nombre, paquete, contacto_email")
    .eq("evento_id", evento.id)
    .order("nombre");

  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);

  const todosSponsors = (sponsorsResult.data ?? []) as SponsorRow[];
  const sponsorsActivos = todosSponsors.filter(
    (sponsor) => !esSponsorPlaceholder(sponsor),
  );
  const sponsorIds = sponsorsActivos.map((sponsor) => sponsor.id);

  let compromisos: CompromisoRow[] = [];
  let archivos: ArchivoRow[] = [];
  let accesos: AccesoRow[] = [];

  if (sponsorIds.length > 0) {
    const [compromisosResult, archivosResult, accesosResult] =
      await Promise.all([
        supabase
          .from("compromisos")
          .select("id, sponsor_id, estados_compromiso(es_estado_final)")
          .in("sponsor_id", sponsorIds),
        supabase
          .from("archivos")
          .select("sponsor_id, tipo, created_at")
          .eq("direccion", "sponsor_sube")
          .in("sponsor_id", sponsorIds),
        supabase
          .from("accesos_personas")
          .select("sponsor_id")
          .in("sponsor_id", sponsorIds),
      ]);

    if (compromisosResult.error) {
      throw new Error(compromisosResult.error.message);
    }
    if (archivosResult.error) throw new Error(archivosResult.error.message);
    if (accesosResult.error) throw new Error(accesosResult.error.message);

    compromisos = (compromisosResult.data ??
      []) as unknown as CompromisoRow[];
    archivos = (archivosResult.data ?? []) as ArchivoRow[];
    accesos = (accesosResult.data ?? []) as AccesoRow[];
  }

  // Agregados por sponsor
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
  for (const acceso of accesos) {
    accesosPorSponsor.set(
      acceso.sponsor_id,
      (accesosPorSponsor.get(acceso.sponsor_id) ?? 0) + 1,
    );
  }

  // Resumen general
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

  // Tabla por sponsor
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
      return {
        id: sponsor.id,
        nombre: sponsor.nombre,
        paquete: sponsor.paquete,
        compromisosCompletados: compromisosSponsor.completados,
        compromisosTotal: compromisosSponsor.total,
        pctInsumos,
        personasRegistradas: accesosPorSponsor.get(sponsor.id) ?? 0,
        ultimaActividad: ultimaActividadPorSponsor.get(sponsor.id) ?? null,
      };
    })
    .sort((a, b) => b.pctInsumos - a.pctInsumos);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de cumplimiento y actividad de los sponsors de{" "}
          {evento.nombre}. Excluye sponsors "Backlog" o sin correo de
          contacto.
        </p>
      </div>

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
              Los sponsors "Backlog" o sin correo de contacto se excluyen de
              estas métricas.
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
                    <TableCell className="font-medium">
                      {fila.nombre}
                    </TableCell>
                    <TableCell>{fila.paquete ?? "—"}</TableCell>
                    <TableCell>
                      {fila.compromisosTotal === 0
                        ? "—"
                        : `${fila.compromisosCompletados}/${fila.compromisosTotal}`}
                    </TableCell>
                    <TableCell>{fila.pctInsumos}%</TableCell>
                    <TableCell>{fila.personasRegistradas}</TableCell>
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
        <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <BarChart2
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-3 font-medium">
            Integración de analytics de tráfico próximamente.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conectar PostHog para ver sesiones diarias, bounce rate y canales
            de adquisición.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a
              href="https://posthog.com/docs/libraries/next-js"
              target="_blank"
              rel="noreferrer"
            >
              Configurar
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
