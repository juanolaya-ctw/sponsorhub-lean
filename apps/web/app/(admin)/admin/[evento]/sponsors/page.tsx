import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  derivarAvance,
  derivarInsumosPendientes,
  derivarLogo,
  derivarPieza,
  derivarStand,
  type ArchivoLogoRow,
} from "@/lib/admin/sponsor-derivados";
import {
  aplicarFiltros,
  parseFiltros,
  type SponsorFiltrable,
} from "@/lib/admin/sponsor-filtros";
import { findEmptyDuplicateSponsors } from "@/lib/notion/merge-sponsors";
import { loadPortalBeneficiosPorSponsor } from "@/lib/portal/beneficios";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DeleteSponsorButton } from "./delete-sponsor-button";
import { SponsorDuplicatesPanel } from "./sponsor-duplicates";
import { SponsorsBuscador } from "./sponsors-buscador";

type SponsorRow = {
  id: string;
  nombre: string;
  paquete: string | null;
  ct_media: boolean | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  pieza_path: string | null;
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
  searchParams,
}: {
  params: Promise<{ evento: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ evento: slug }, query] = await Promise.all([params, searchParams]);
  const filtros = parseFiltros(query);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sponsors")
    .select(
      "id, nombre, paquete, ct_media, contacto_nombre, contacto_email, pieza_path, created_at, eventos!inner(slug)",
    )
    .eq("eventos.slug", slug)
    .is("archivado_at", null)
    .order("nombre");

  if (error) {
    throw new Error(error.message);
  }

  const todos = (data ?? []) as SponsorRow[];
  const sponsorIds = todos.map((sponsor) => sponsor.id);

  const [beneficiosPorSponsor, logosResult] = await Promise.all([
    loadPortalBeneficiosPorSponsor(supabase, sponsorIds),
    sponsorIds.length > 0
      ? supabase
          .from("archivos")
          .select("sponsor_id, tipo, nombre_archivo, storage_path")
          .in("sponsor_id", sponsorIds)
          .in("tipo", ["logo_ai", "logo"])
          .in("direccion", ["sponsor_sube", "admin_sube_por_sponsor"])
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (logosResult.error) throw new Error(logosResult.error.message);

  const logosPorSponsor = new Map<string, ArchivoLogoRow[]>();
  for (const row of (logosResult.data ?? []) as ArchivoLogoRow[]) {
    const lista = logosPorSponsor.get(row.sponsor_id) ?? [];
    lista.push(row);
    logosPorSponsor.set(row.sponsor_id, lista);
  }

  const filtrables: SponsorFiltrable[] = todos.map((sponsor) => {
    const beneficios = beneficiosPorSponsor.get(sponsor.id) ?? [];
    const { pct, avance } = derivarAvance(beneficios);
    return {
      id: sponsor.id,
      nombre: sponsor.nombre,
      paquete: sponsor.paquete,
      contactoNombre: sponsor.contacto_nombre,
      contactoEmail: sponsor.contacto_email,
      ctMedia: sponsor.ct_media === true,
      avancePct: pct,
      avance,
      logo: derivarLogo(logosPorSponsor.get(sponsor.id) ?? []),
      pieza: derivarPieza(sponsor.pieza_path),
      insumosPendientes: derivarInsumosPendientes(beneficios),
      stand: derivarStand(beneficios),
    };
  });
  const filtrablePorId = new Map(filtrables.map((item) => [item.id, item]));
  const idsVisibles = new Set(
    aplicarFiltros(filtrables, filtros).map((item) => item.id),
  );
  const sponsors = todos.filter((sponsor) => idsVisibles.has(sponsor.id));
  const tiers = [
    ...new Set(todos.map((sponsor) => sponsor.paquete ?? "Sin paquete")),
  ].sort((a, b) => a.localeCompare(b, "es"));

  let duplicateCandidates: Awaited<
    ReturnType<typeof findEmptyDuplicateSponsors>
  > = [];
  try {
    const { data: eventoRow } = await supabase
      .from("eventos")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (eventoRow?.id) {
      duplicateCandidates = await findEmptyDuplicateSponsors(
        createAdminClient(),
        eventoRow.id as string,
      );
    }
  } catch {
    duplicateCandidates = [];
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Sponsors</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sponsors del evento activo
      </p>

      <SponsorDuplicatesPanel
        eventoSlug={slug}
        initialCandidates={duplicateCandidates}
      />

      {todos.length > 0 ? (
        <SponsorsBuscador
          filtros={filtros}
          tiers={tiers}
          total={todos.length}
          visibles={sponsors.length}
        />
      ) : null}

      {todos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Este evento aún no tiene sponsors</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando el sync o el equipo de CT cargue sponsors, aparecerán en esta
            tabla.
          </p>
        </div>
      ) : sponsors.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-medium">Ningún sponsor coincide con los filtros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quita algún filtro o usa «Limpiar filtros».
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Paquete / tier</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Logo</TableHead>
                <TableHead>CT Media</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsors.map((sponsor) => (
                <TableRow key={sponsor.id}>
                  <TableCell className="font-medium">{sponsor.nombre}</TableCell>
                  <TableCell>{sponsor.paquete ?? "—"}</TableCell>
                  <TableCell>
                    {filtrablePorId.get(sponsor.id)?.avancePct ?? 0}%
                  </TableCell>
                  <TableCell className="text-sm">
                    {{
                      sin_logo: "Sin logo",
                      necesita_png: "Falta PNG/SVG",
                      usable: filtrablePorId.get(sponsor.id)?.pieza === "generada" ? "Pieza lista" : "Con logo",
                    }[filtrablePorId.get(sponsor.id)?.logo ?? "sin_logo"]}
                  </TableCell>
                  <TableCell>
                    {sponsor.ct_media ? (
                      <span className="rounded-full bg-[#42B3F3]/15 px-2 py-0.5 text-xs font-medium text-[#0b6ea8]">
                        Media
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{sponsor.contacto_email ?? "—"}</TableCell>
                  <TableCell>{formatDateTime(sponsor.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/${slug}/sponsors/${sponsor.id}`}
                        className="text-sm text-secondary hover:underline"
                      >
                        Ver
                      </Link>
                      <DeleteSponsorButton
                        sponsorId={sponsor.id}
                        sponsorNombre={sponsor.nombre}
                        eventoSlug={slug}
                      />
                    </div>
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
