import Link from "next/link";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { INSUMOS_REQUERIDOS } from "@/lib/portal/insumos";
import { Button } from "@/components/ui/button";
import { WelcomeOnboardingDialog } from "./welcome-onboarding-dialog";

type TimelineItem = {
  compromiso_id: string;
  categoria: string | null;
  beneficio: string | null;
  estado_nombre: string | null;
  estado_color: string | null;
  fecha_limite: string | null;
};

type CatalogoItem = {
  id: string;
  categoria: string;
  beneficio: string;
};

type TimelineRow = {
  key: string;
  beneficio: string;
  categoria: string;
  estadoNombre: string | null;
  estadoColor: string | null;
  fechaLimite: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function groupByCategoria(rows: TimelineRow[]) {
  return rows.reduce((groups, row) => {
    const current = groups.get(row.categoria) ?? [];
    current.push(row);
    groups.set(row.categoria, current);
    return groups;
  }, new Map<string, TimelineRow[]>());
}

function EstadoBadge({
  nombre,
  color,
}: {
  nombre: string | null;
  color: string | null;
}) {
  if (!nombre) {
    return (
      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Pendiente
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: color ?? undefined,
        backgroundColor: color ? `${color}20` : undefined,
      }}
    >
      {nombre}
    </span>
  );
}

export default async function SponsorDashboardPage() {
  const [{ supabase }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  const [timelineResult, archivosResult] = await Promise.all([
    supabase
      .from("v_timeline_sponsor")
      .select(
        "compromiso_id, categoria, beneficio, estado_nombre, estado_color, fecha_limite",
      )
      .eq("sponsor_id", sponsor.sponsorId),
    supabase
      .from("archivos")
      .select("id, direccion")
      .eq("sponsor_id", sponsor.sponsorId)
      .eq("direccion", "sponsor_sube"),
  ]);

  if (timelineResult.error) throw new Error(timelineResult.error.message);
  if (archivosResult.error) throw new Error(archivosResult.error.message);

  const timeline = (timelineResult.data ?? []) as TimelineItem[];
  const tieneArchivos = (archivosResult.data ?? []).length > 0;

  // Fallback: si aún no hay compromisos generados, mostramos los beneficios
  // del tier del sponsor directamente desde el catálogo.
  let catalogo: CatalogoItem[] = [];
  if (timeline.length === 0 && sponsor.paquete && sponsor.eventoId) {
    const catalogoResult = await supabase
      .from("catalogo_beneficios")
      .select("id, categoria, beneficio")
      .eq("evento_id", sponsor.eventoId)
      .eq("tier", sponsor.paquete)
      .order("orden");
    if (catalogoResult.error) throw new Error(catalogoResult.error.message);
    catalogo = (catalogoResult.data ?? []) as CatalogoItem[];
  }

  const rows: TimelineRow[] =
    timeline.length > 0
      ? timeline.map((item) => ({
          key: item.compromiso_id,
          beneficio: item.beneficio ?? "Beneficio",
          categoria: item.categoria ?? "Otros",
          estadoNombre: item.estado_nombre,
          estadoColor: item.estado_color,
          fechaLimite: item.fecha_limite,
        }))
      : catalogo.map((item) => ({
          key: item.id,
          beneficio: item.beneficio,
          categoria: item.categoria ?? "Otros",
          estadoNombre: null,
          estadoColor: null,
          fechaLimite: null,
        }));

  const porCategoria = groupByCategoria(rows);

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      {!tieneArchivos ? (
        <WelcomeOnboardingDialog insumos={INSUMOS_REQUERIDOS} />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hola, {sponsor.sponsorNombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es el estado de tus beneficios del evento.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/portal/recursos">Gestionar recursos</Link>
        </Button>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Tus beneficios</h2>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Todavía no hay beneficios para mostrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              En cuanto el equipo de ColombiaTech configure tu paquete, verás
              aquí el detalle y el estado de cada beneficio.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {Array.from(porCategoria.entries()).map(([categoria, items]) => (
              <article
                key={categoria}
                className="overflow-hidden rounded-xl border border-border bg-white"
              >
                <h3 className="border-b border-border bg-muted/50 px-4 py-3 font-semibold">
                  {categoria}
                </h3>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.key} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{item.beneficio}</p>
                        <EstadoBadge
                          nombre={item.estadoNombre}
                          color={item.estadoColor}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(item.fechaLimite)}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
