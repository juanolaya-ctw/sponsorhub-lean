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
import { TierSelect } from "../sponsors/tier-select";
import { AddBeneficioForm } from "./add-beneficio-form";
import { DeleteBeneficioButton } from "./delete-beneficio-button";

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

  const [catalogoResult, sponsorsResult] = await Promise.all([
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
  ]);

  if (catalogoResult.error) throw new Error(catalogoResult.error.message);
  if (sponsorsResult.error) throw new Error(sponsorsResult.error.message);

  const beneficios = (catalogoResult.data ?? []) as Beneficio[];
  const sponsors = (sponsorsResult.data ?? []) as Sponsor[];
  const porTier = beneficios.reduce((groups, item) => {
    const current = groups.get(item.tier) ?? [];
    current.push(item);
    groups.set(item.tier, current);
    return groups;
  }, new Map<string, Beneficio[]>());
  const tiers = Array.from(porTier.keys());
  const isGovtech = evento.slug === GOVTECH_EVENT_SLUG;

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
