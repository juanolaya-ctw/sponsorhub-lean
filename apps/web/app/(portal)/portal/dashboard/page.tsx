import Link from "next/link";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import {
  loadPortalBeneficios,
  resumenProgreso,
} from "@/lib/portal/beneficios";
import { Button } from "@/components/ui/button";
import { WelcomeOnboardingDialog } from "./welcome-onboarding-dialog";

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

  const [beneficios, timelineResult] = await Promise.all([
    loadPortalBeneficios(supabase, sponsor.sponsorId),
    supabase
      .from("v_timeline_sponsor")
      .select(
        "compromiso_id, categoria, beneficio, estado_nombre, estado_color, fecha_limite",
      )
      .eq("sponsor_id", sponsor.sponsorId),
  ]);

  if (timelineResult.error) throw new Error(timelineResult.error.message);

  const progreso = resumenProgreso(beneficios);
  const pendientes = beneficios.filter(
    (item) => item.tipo !== "informativo" && !item.progreso.completed,
  );

  const timeline = timelineResult.data ?? [];

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
          key: item.compromiso_id as string,
          beneficio: (item.beneficio as string | null) ?? "Beneficio",
          categoria: (item.categoria as string | null) ?? "Otros",
          estadoNombre: (item.estado_nombre as string | null) ?? null,
          estadoColor: (item.estado_color as string | null) ?? null,
          fechaLimite: (item.fecha_limite as string | null) ?? null,
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
      {progreso.completados === 0 && pendientes.length > 0 ? (
        <WelcomeOnboardingDialog
          beneficios={pendientes.map((item) => ({
            compromisoId: item.compromisoId,
            beneficio: item.beneficio,
            categoria: item.categoria,
          }))}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hola, {sponsor.sponsorNombre}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este es el estado de tus beneficios del evento.
          </p>
        </div>
        <Button
          asChild
          className="bg-[#040402] text-white hover:bg-[#040402]/90"
        >
          <Link href="/portal/recursos">Gestionar beneficios</Link>
        </Button>
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">Progreso general</h2>
          <span className="text-sm font-semibold text-muted-foreground">
            {progreso.pct}%
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#42B3F3] transition-all"
            style={{ width: `${progreso.pct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {progreso.completados} de {progreso.total} beneficios completados
        </p>
      </section>

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
