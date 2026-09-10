import { getEventoBySlug } from "@/lib/admin/eventos";
import { ResolverAlertaButton } from "./resolver-alerta-button";

type Alerta = {
  id: string;
  tipo: string;
  detalle: string;
  created_at: string;
  sponsors: { nombre: string } | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AlertasPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);
  const { data, error } = await supabase
    .from("alertas_sync")
    .select("id, tipo, detalle, created_at, sponsors(nombre)")
    .eq("evento_id", evento.id)
    .eq("resuelta", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const alertas = (data ?? []) as unknown as Alerta[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Alertas de sincronización</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Situaciones que requieren revisión del equipo de CT.
      </p>

      {alertas.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay alertas pendientes</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {alertas.map((alerta) => (
            <li key={alerta.id} className="flex items-start gap-4 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {alerta.tipo}
                  </span>
                  <span className="font-medium">{alerta.sponsors?.nombre ?? "Sin sponsor"}</span>
                </div>
                <p className="mt-2 text-sm">{alerta.detalle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(alerta.created_at)}
                </p>
              </div>
              <ResolverAlertaButton id={alerta.id} slug={evento.slug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
