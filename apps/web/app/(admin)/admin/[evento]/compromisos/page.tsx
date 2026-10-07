import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { GOVTECH_EVENT_SLUG } from "@/lib/notion/client";
import { esBeneficioFormulario } from "@/lib/portal/beneficios";
import { TierSelect } from "../sponsors/tier-select";
import { AddBeneficioForm } from "./add-beneficio-form";
import { DeleteBeneficioButton } from "./delete-beneficio-button";
import { EntregablesBulkButton } from "./entregables-bulk";
import { EntregablesEnviados, type EntregaBatch } from "./entregables-enviados";
import {
  FormulariosEventoSection,
  type FormularioEventoRow,
} from "./formularios-evento";

type Beneficio = {
  id: string;
  tier: string;
  categoria: string;
  beneficio: string;
  cantidad: number | null;
  notas: string | null;
};

type Sponsor = {
  id: string;
  nombre: string;
  paquete: string | null;
};

export default async function CompromisosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const [catalogoResult, sponsorsResult, formulariosResult] = await Promise.all([
    supabase
      .from("catalogo_beneficios")
      .select("id, tier, categoria, beneficio, cantidad, notas")
      .eq("evento_id", evento.id)
      .order("tier")
      .order("orden"),
    supabase
      .from("sponsors")
      .select("id, nombre, paquete")
      .eq("evento_id", evento.id)
      .order("nombre"),
    supabase
      .from("beneficio_formularios")
      .select("beneficio_nombre, url")
      .eq("evento_id", evento.id),
  ]);

  if (catalogoResult.error) throw new Error(catalogoResult.error.message);
  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);
  // Si la migración 0015 aún no corrió, no tumbar la página.
  if (formulariosResult.error && formulariosResult.error.code !== "42P01") {
    throw new Error(formulariosResult.error.message);
  }

  const beneficios = (catalogoResult.data ?? []) as Beneficio[];
  const sponsors = (sponsorsResult.data ?? []) as Sponsor[];
  const formularioByNombre = new Map(
    (formulariosResult.data ?? []).map((row) => [
      row.beneficio_nombre as string,
      row.url as string,
    ]),
  );

  // Fetch all ctw_entrega archivos for this event's sponsors
  const sponsorIds = sponsors.map((s) => s.id);
  const sponsorById = new Map(sponsors.map((s) => [s.id, s]));
  const entregasEnviadas: EntregaBatch[] = [];

  if (sponsorIds.length > 0) {
    const { data: entregasData } = await supabase
      .from("archivos")
      .select("id, tipo, nombre_archivo, storage_path, created_at, sponsor_id")
      .in("sponsor_id", sponsorIds)
      .eq("direccion", "ctw_entrega")
      .order("created_at", { ascending: false });

    if (entregasData) {
      // Group by storage_path, keeping insertion order (most recent first)
      const batchMap = new Map<string, EntregaBatch>();
      for (const row of entregasData) {
        const path = row.storage_path as string;
        const sponsor = sponsorById.get(row.sponsor_id as string);
        if (!sponsor) continue;
        if (!batchMap.has(path)) {
          batchMap.set(path, {
            storagePath: path,
            tipo: row.tipo as string,
            nombre: row.nombre_archivo as string,
            isLink: /^https?:\/\//i.test(path),
            createdAt: row.created_at as string,
            rows: [],
          });
        }
        batchMap.get(path)!.rows.push({
          archivoId: row.id as string,
          sponsorId: sponsor.id,
          sponsorNombre: sponsor.nombre,
          sponsorPaquete: sponsor.paquete,
        });
      }
      entregasEnviadas.push(...batchMap.values());
    }
  }
  const porTier = beneficios.reduce((groups, item) => {
    const current = groups.get(item.tier) ?? [];
    current.push(item);
    groups.set(item.tier, current);
    return groups;
  }, new Map<string, Beneficio[]>());
  const tiers = Array.from(porTier.keys());
  const isGovtech = evento.slug === GOVTECH_EVENT_SLUG;

  // Beneficios de speaking/moderación presentes en compromisos del evento
  // (una fila por nombre → un link para todos los sponsors).
  const formulariosEvento: FormularioEventoRow[] = [];
  if (sponsorIds.length > 0) {
    const { data: compromisosData, error: compromisosError } = await supabase
      .from("compromisos")
      .select("tipo, sponsor_id")
      .in("sponsor_id", sponsorIds);
    if (compromisosError) throw new Error(compromisosError.message);

    const counts = new Map<string, Set<string>>();
    for (const row of compromisosData ?? []) {
      const nombre = row.tipo as string;
      if (!esBeneficioFormulario(nombre)) continue;
      const set = counts.get(nombre) ?? new Set<string>();
      set.add(row.sponsor_id as string);
      counts.set(nombre, set);
    }
    formulariosEvento.push(
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, "es"))
        .map(([beneficioNombre, set]) => ({
          beneficioNombre,
          sponsorsCount: set.size,
          url: formularioByNombre.get(beneficioNombre) ?? null,
        })),
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Compromisos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isGovtech
            ? "Catálogo de referencia por tier. Los compromisos reales vienen de LAB Beneficios."
            : "Configura los beneficios por tier y asigna el tier de cada sponsor."}
        </p>
      </div>

      {isGovtech ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          En GovTech, el catálogo es solo referencia visual. Los beneficios
          operativos se sincronizan desde LAB Beneficios y se gestionan en el
          detalle de cada sponsor.
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Beneficios por tier</h2>
        {tiers.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Este evento no tiene beneficios configurados</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {Array.from(porTier.entries()).map(([tier, items]) => (
              <article
                key={tier}
                className="overflow-hidden rounded-xl border border-border bg-white"
              >
                <h3 className="border-b border-border bg-muted/50 px-4 py-3 font-semibold">
                  {tier}
                </h3>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.beneficio}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.categoria}
                          {item.cantidad !== null
                            ? ` · Cantidad: ${item.cantidad}`
                            : ""}
                        </p>
                        {item.notas ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.notas}
                          </p>
                        ) : null}
                      </div>
                      <DeleteBeneficioButton
                        id={item.id}
                        eventoSlug={evento.slug}
                        nombre={item.beneficio}
                      />
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border p-4">
                  <AddBeneficioForm
                    eventoId={evento.id}
                    eventoSlug={evento.slug}
                    tier={tier}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Formularios Speaking / Moderación
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Un link por beneficio para todos los sponsors que lo tengan (p. ej.
          Speaking Slot Main Stage, Moderación de sesión en Policy Lab).
        </p>
        <FormulariosEventoSection
          eventoId={evento.id}
          eventoSlug={evento.slug}
          rows={formulariosEvento}
        />
      </section>

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Entregables de ColombiaTech</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Archivos y links enviados a los sponsors. Puedes eliminarlos para todos o para sponsors específicos.
            </p>
          </div>
          <EntregablesBulkButton sponsors={sponsors} eventoSlug={evento.slug} />
        </div>
        <EntregablesEnviados batches={entregasEnviadas} eventoSlug={evento.slug} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">Sponsors y tier asignado</h2>
        {sponsors.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Este evento no tiene sponsors</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del sponsor</TableHead>
                  <TableHead>Tier actual</TableHead>
                  <TableHead>Cambiar tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsors.map((sponsor) => (
                  <TableRow key={sponsor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{sponsor.nombre}</span>
                        <Link
                          href={`/admin/${evento.slug}/sponsors/${sponsor.id}`}
                          className="text-xs text-secondary hover:underline"
                        >
                          Ver detalle
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{sponsor.paquete ?? "Sin asignar"}</TableCell>
                    <TableCell>
                      <TierSelect
                        sponsorId={sponsor.id}
                        eventoSlug={evento.slug}
                        currentTier={sponsor.paquete}
                        tiers={tiers}
                      />
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
