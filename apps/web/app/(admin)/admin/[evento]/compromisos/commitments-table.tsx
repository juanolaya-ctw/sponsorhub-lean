import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoSelect } from "./estado-select";
import { FechaLimiteInput } from "./fecha-limite-input";

export type EstadoOption = {
  id: string;
  nombre: string;
  color: string | null;
};

export type CompromisoRow = {
  id: string;
  tipo: string;
  fecha_limite: string | null;
  estado_id: string | null;
  sponsors: { nombre: string } | null;
  catalogo_beneficios: { beneficio: string } | null;
};

export function CommitmentsTable({
  compromisos,
  estados,
  eventoSlug,
  showSponsor = true,
}: {
  compromisos: CompromisoRow[];
  estados: EstadoOption[];
  eventoSlug: string;
  showSponsor?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {showSponsor ? <TableHead>Sponsor</TableHead> : null}
            <TableHead>Beneficio</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha límite</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {compromisos.map((compromiso) => (
            <TableRow key={compromiso.id}>
              {showSponsor ? (
                <TableCell className="font-medium">
                  {compromiso.sponsors?.nombre ?? "—"}
                </TableCell>
              ) : null}
              <TableCell>
                {compromiso.catalogo_beneficios?.beneficio ?? compromiso.tipo}
              </TableCell>
              <TableCell>
                <EstadoSelect
                  compromisoId={compromiso.id}
                  estadoId={compromiso.estado_id}
                  eventoSlug={eventoSlug}
                  estados={estados}
                />
              </TableCell>
              <TableCell>
                <FechaLimiteInput
                  compromisoId={compromiso.id}
                  fechaLimite={compromiso.fecha_limite}
                  eventoSlug={eventoSlug}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
