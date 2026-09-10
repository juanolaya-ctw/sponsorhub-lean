import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSUMOS_REQUERIDOS } from "@/lib/portal/insumos";

const BUCKET = "sponsorhub-archivos";
const SIGNED_URL_TTL = 60 * 60; // 1 hora

type SponsorDetalle = {
  id: string;
  nombre: string;
  paquete: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
};

type ArchivoSponsor = {
  id: string;
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
};

const INSUMO_LABEL = new Map(
  INSUMOS_REQUERIDOS.map((insumo) => [insumo.key, insumo.nombre]),
);

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isExternalLink(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export default async function SponsorDetallePage({
  params,
}: {
  params: Promise<{ evento: string; id: string }>;
}) {
  const { evento: slug, id } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const { data: sponsorData, error: sponsorError } = await supabase
    .from("sponsors")
    .select(
      "id, nombre, paquete, contacto_nombre, contacto_email, contacto_telefono",
    )
    .eq("id", id)
    .eq("evento_id", evento.id)
    .maybeSingle();

  if (sponsorError) throw new Error(sponsorError.message);
  if (!sponsorData) notFound();
  const sponsor = sponsorData as SponsorDetalle;

  const { data: archivosData, error: archivosError } = await supabase
    .from("archivos")
    .select("id, tipo, nombre_archivo, storage_path, created_at")
    .eq("sponsor_id", sponsor.id)
    .eq("direccion", "sponsor_sube")
    .order("created_at", { ascending: false });

  if (archivosError) throw new Error(archivosError.message);
  const archivos = (archivosData ?? []) as ArchivoSponsor[];

  // Las URLs firmadas se generan con el cliente de service_role porque las
  // policies de Storage solo dan acceso al propio sponsor. Esta página está
  // detrás de requireAdmin (getEventoBySlug), así que el acceso ya está
  // validado. Se recalcula en cada carga — sin tiempo real.
  const admin = createAdminClient();
  const archivosConUrl = await Promise.all(
    archivos.map(async (archivo) => {
      if (isExternalLink(archivo.storage_path)) {
        return { ...archivo, url: archivo.storage_path, esEnlace: true };
      }
      if (archivo.storage_path === "texto") {
        return { ...archivo, url: null, esEnlace: false };
      }
      const { data } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(archivo.storage_path, SIGNED_URL_TTL);
      return { ...archivo, url: data?.signedUrl ?? null, esEnlace: false };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{sponsor.nombre}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {evento.nombre}
          {sponsor.paquete ? ` · ${sponsor.paquete}` : ""}
        </p>
        {sponsor.contacto_nombre || sponsor.contacto_email || sponsor.contacto_telefono ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              sponsor.contacto_nombre,
              sponsor.contacto_email,
              sponsor.contacto_telefono,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Insumos del sponsor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Archivos y contenidos que el sponsor subió al portal.
        </p>

        {archivosConUrl.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Este sponsor aún no ha subido insumos</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de insumo</TableHead>
                  <TableHead>Archivo / contenido</TableHead>
                  <TableHead>Fecha de subida</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivosConUrl.map((archivo) => (
                  <TableRow key={archivo.id}>
                    <TableCell className="font-medium">
                      {INSUMO_LABEL.get(archivo.tipo) ?? archivo.tipo}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {archivo.nombre_archivo}
                    </TableCell>
                    <TableCell>{formatDateTime(archivo.created_at)}</TableCell>
                    <TableCell>
                      {archivo.url ? (
                        <a
                          href={archivo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-secondary hover:underline"
                        >
                          {archivo.esEnlace ? "Abrir enlace" : "Ver / descargar"}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin archivo
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
