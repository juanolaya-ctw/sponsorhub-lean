import { CreateEstadoForm } from "./create-estado-form";
import { DeleteEstadoButton } from "./delete-estado-button";
import { getEventoBySlug } from "@/lib/admin/eventos";

type EstadoRow = {
  id: string;
  evento_id: string | null;
  nombre: string;
  color: string | null;
  orden: number;
  es_estado_final: boolean;
};

export default async function EstadosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const { data, error } = await supabase
    .from("estados_compromiso")
    .select("id, evento_id, nombre, color, orden, es_estado_final")
    .or(`evento_id.eq.${evento.id},evento_id.is.null`)
    .order("orden");

  if (error) {
    throw new Error(error.message);
  }

  const estados = (data ?? []) as EstadoRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Estados de compromiso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Growth puede crear y quitar estados sin una migración de código.
        </p>
      </div>

      <CreateEstadoForm eventoId={evento.id} slug={evento.slug} />

      {estados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay estados todavía</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el primero con el formulario de arriba.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {estados.map((estado) => (
            <li key={estado.id} className="flex items-center gap-4 px-4 py-3">
              <span
                className="size-4 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: estado.color ?? "#e5e5e5" }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{estado.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  Orden {estado.orden}
                  {estado.es_estado_final ? " · Estado final" : ""}
                  {estado.evento_id ? "" : " · Global"}
                </p>
              </div>
              <DeleteEstadoButton
                id={estado.id}
                slug={evento.slug}
                nombre={estado.nombre}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
