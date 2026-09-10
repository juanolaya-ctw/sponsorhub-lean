import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

type SponsorRow = {
  id: string;
  nombre: string;
  paquete: string | null;
  contacto_email: string | null;
  created_at: string;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function SponsorsPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sponsors")
    .select("id, nombre, paquete, contacto_email, created_at, eventos!inner(slug)")
    .eq("eventos.slug", slug)
    .order("nombre");

  if (error) {
    throw new Error(error.message);
  }

  const sponsors = (data ?? []) as SponsorRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Sponsors</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sponsors del evento activo
      </p>

      {sponsors.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Este evento aún no tiene sponsors</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando el sync o el equipo de CT cargue sponsors, aparecerán en esta
            tabla.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Paquete / tier</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsors.map((sponsor) => (
                <TableRow key={sponsor.id}>
                  <TableCell className="font-medium">{sponsor.nombre}</TableCell>
                  <TableCell>{sponsor.paquete ?? "—"}</TableCell>
                  <TableCell>{sponsor.contacto_email ?? "—"}</TableCell>
                  <TableCell>{formatDateTime(sponsor.created_at)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/${slug}/sponsors/${sponsor.id}`}
                      className="text-sm text-secondary hover:underline"
                    >
                      Ver
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
