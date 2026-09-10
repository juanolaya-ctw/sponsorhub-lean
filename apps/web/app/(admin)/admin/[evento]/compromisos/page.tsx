import { getEventoBySlug } from "@/lib/admin/eventos";
import { AddCompromisoForm } from "./add-compromiso-form";
import {
  CommitmentsTable,
  type CompromisoRow,
  type EstadoOption,
} from "./commitments-table";

export default async function CompromisosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const [compromisosResult, estadosResult, sponsorsResult] = await Promise.all([
    supabase
      .from("compromisos")
      .select(
        "id, tipo, fecha_limite, estado_id, sponsors!inner(nombre, evento_id), catalogo_beneficios(beneficio)",
      )
      .eq("sponsors.evento_id", evento.id)
      .order("fecha_limite"),
    supabase
      .from("estados_compromiso")
      .select("id, nombre, color")
      .or(`evento_id.eq.${evento.id},evento_id.is.null`)
      .order("orden"),
    supabase
      .from("sponsors")
      .select("id, nombre")
      .eq("evento_id", evento.id)
      .order("nombre"),
  ]);

  if (compromisosResult.error) throw new Error(compromisosResult.error.message);
  if (estadosResult.error) throw new Error(estadosResult.error.message);
  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);

  const compromisos = (compromisosResult.data ?? []) as unknown as CompromisoRow[];
  const estados = (estadosResult.data ?? []) as EstadoOption[];
  const sponsors = (sponsorsResult.data ?? []) as { id: string; nombre: string }[];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Configuración de compromisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona beneficios, estados y fechas límite de todos los sponsors.
          </p>
        </div>
        <AddCompromisoForm
          eventoId={evento.id}
          eventoSlug={evento.slug}
          sponsors={sponsors}
          estados={estados}
        />
      </div>

      {compromisos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay compromisos para este evento</p>
        </div>
      ) : (
        <div className="mt-6">
          <CommitmentsTable
            compromisos={compromisos}
            estados={estados}
            eventoSlug={evento.slug}
          />
        </div>
      )}
    </div>
  );
}
