import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { DownloadButton } from "./download-button";
import { UploadResourceForm } from "./upload-resource-form";

type TimelineItem = {
  compromiso_id: string;
  categoria: string | null;
  beneficio: string | null;
  estado_nombre: string | null;
  estado_color: string | null;
  fecha_limite: string | null;
};

type Archivo = {
  id: string;
  direccion: "sponsor_sube" | "ctw_entrega";
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SponsorDashboardPage() {
  const [{ supabase, user }, sponsor] = await Promise.all([
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
      .select("id, direccion, tipo, nombre_archivo, storage_path, created_at")
      .eq("sponsor_id", sponsor.sponsorId)
      .order("created_at", { ascending: false }),
  ]);

  if (timelineResult.error) throw new Error(timelineResult.error.message);
  if (archivosResult.error) throw new Error(archivosResult.error.message);

  const timeline = (timelineResult.data ?? []) as TimelineItem[];
  const archivos = (archivosResult.data ?? []) as Archivo[];
  const timelinePorCategoria = timeline.reduce((groups, item) => {
    const categoria = item.categoria ?? "Otros";
    const current = groups.get(categoria) ?? [];
    current.push(item);
    groups.set(categoria, current);
    return groups;
  }, new Map<string, TimelineItem[]>());
  const sponsorSube = archivos.filter((item) => item.direccion === "sponsor_sube");
  const ctEntrega = archivos.filter((item) => item.direccion === "ctw_entrega");

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {sponsor.sponsorNombre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta tus beneficios y gestiona los recursos del evento.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Tus beneficios</h2>
        {timeline.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Aún no tienes beneficios publicados</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {Array.from(timelinePorCategoria.entries()).map(([categoria, items]) => (
              <article key={categoria} className="overflow-hidden rounded-xl border border-border bg-white">
                <h3 className="border-b border-border bg-muted/50 px-4 py-3 font-semibold">
                  {categoria}
                </h3>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.compromiso_id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{item.beneficio ?? "Beneficio"}</p>
                        <span
                          className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
                          style={{
                            borderColor: item.estado_color ?? undefined,
                            backgroundColor: item.estado_color
                              ? `${item.estado_color}20`
                              : undefined,
                          }}
                        >
                          {item.estado_nombre ?? "Sin estado"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(item.fecha_limite)}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold">Tus recursos</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-white p-5">
            <h3 className="font-semibold">Subir insumos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comparte con CT logos, piezas y demás archivos requeridos.
            </p>
            <UploadResourceForm sponsorId={sponsor.sponsorId} userId={user.id} />
            <ul className="mt-4 divide-y divide-border">
              {sponsorSube.length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">No has subido archivos.</li>
              ) : (
                sponsorSube.map((archivo) => (
                  <li key={archivo.id} className="py-3">
                    <p className="font-medium">{archivo.nombre_archivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {archivo.tipo} · {formatDateTime(archivo.created_at)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-white p-5">
            <h3 className="font-semibold">Descargar de CT</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Entregables que el equipo de ColombiaTech preparó para ti.
            </p>
            <ul className="mt-4 divide-y divide-border">
              {ctEntrega.length === 0 ? (
                <li className="py-4 text-sm text-muted-foreground">
                  CT aún no ha publicado archivos.
                </li>
              ) : (
                ctEntrega.map((archivo) => (
                  <li key={archivo.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{archivo.nombre_archivo}</p>
                      <p className="text-xs text-muted-foreground">{archivo.tipo}</p>
                    </div>
                    <DownloadButton
                      path={archivo.storage_path}
                      filename={archivo.nombre_archivo}
                    />
                  </li>
                ))
              )}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
