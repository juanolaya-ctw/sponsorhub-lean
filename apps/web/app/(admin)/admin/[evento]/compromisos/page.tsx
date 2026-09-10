import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { EstadoSelect } from "./estado-select";

type Estado = {
  id: string;
  nombre: string;
  color: string | null;
};

type Compromiso = {
  id: string;
  tipo: string;
  fecha_limite: string | null;
  estado_id: string | null;
  sponsors: { nombre: string } | null;
  catalogo_beneficios: { beneficio: string } | null;
  estados_compromiso: Estado | null;
};

function formatFecha(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

export default async function CompromisosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const [compromisosResult, estadosResult] = await Promise.all([
    supabase
      .from("compromisos")
      .select(
        "id, tipo, fecha_limite, estado_id, sponsors!inner(nombre, evento_id), catalogo_beneficios(beneficio), estados_compromiso(id, nombre, color)",
      )
      .eq("sponsors.evento_id", evento.id)
      .order("fecha_limite"),
    supabase
      .from("estados_compromiso")
      .select("id, nombre, color")
      .or(`evento_id.eq.${evento.id},evento_id.is.null`)
      .order("orden"),
  ]);

  if (compromisosResult.error) throw new Error(compromisosResult.error.message);
  if (estadosResult.error) throw new Error(estadosResult.error.message);

  const compromisos = (compromisosResult.data ?? []) as unknown as Compromiso[];
  const estados = (estadosResult.data ?? []) as Estado[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Compromisos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Esta es la única superficie para cambiar el estado de cumplimiento.
      </p>

      {compromisos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay compromisos para este evento</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Tipo / beneficio</TableHead>
                <TableHead>Estado actual</TableHead>
                <TableHead>Cambiar estado</TableHead>
                <TableHead>Fecha límite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compromisos.map((compromiso) => {
                const estado = compromiso.estados_compromiso;
                return (
                  <TableRow key={compromiso.id}>
                    <TableCell className="font-medium">
                      {compromiso.sponsors?.nombre ?? "—"}
                    </TableCell>
                    <TableCell>
                      {compromiso.catalogo_beneficios?.beneficio ?? compromiso.tipo}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium"
                        style={{
                          borderColor: estado?.color ?? undefined,
                          backgroundColor: estado?.color
                            ? `${estado.color}20`
                            : undefined,
                        }}
                      >
                        {estado?.nombre ?? "Sin estado"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EstadoSelect
                        compromisoId={compromiso.id}
                        estadoId={compromiso.estado_id}
                        eventoSlug={evento.slug}
                        estados={estados}
                      />
                    </TableCell>
                    <TableCell>{formatFecha(compromiso.fecha_limite)}</TableCell>
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
