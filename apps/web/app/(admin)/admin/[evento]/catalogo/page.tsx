import { getEventoBySlug } from "@/lib/admin/eventos";
import { CreateBeneficioForm } from "./create-beneficio-form";
import { DeleteBeneficioButton } from "./delete-beneficio-button";

type Beneficio = {
  id: string;
  tier: string;
  categoria: string;
  beneficio: string;
  cantidad: number | null;
  notas: string | null;
};

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);
  const { data, error } = await supabase
    .from("catalogo_beneficios")
    .select("id, tier, categoria, beneficio, cantidad, notas")
    .eq("evento_id", evento.id)
    .order("tier")
    .order("orden");

  if (error) throw new Error(error.message);
  const beneficios = (data ?? []) as Beneficio[];
  const porTier = beneficios.reduce((groups, item) => {
    const current = groups.get(item.tier) ?? [];
    current.push(item);
    groups.set(item.tier, current);
    return groups;
  }, new Map<string, Beneficio[]>());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Catálogo de beneficios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Beneficios que se generan para cada sponsor según su tier.
        </p>
      </div>

      <CreateBeneficioForm eventoId={evento.id} slug={evento.slug} />

      {beneficios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Este evento no tiene catálogo</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(porTier.entries()).map(([tier, items]) => (
            <section key={tier} className="overflow-hidden rounded-xl border border-border bg-white">
              <h2 className="border-b border-border bg-muted/50 px-4 py-3 font-semibold">
                {tier}
              </h2>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.beneficio}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.categoria}
                        {item.cantidad !== null ? ` · Cantidad: ${item.cantidad}` : ""}
                      </p>
                      {item.notas ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.notas}</p>
                      ) : null}
                    </div>
                    <DeleteBeneficioButton
                      id={item.id}
                      slug={evento.slug}
                      nombre={item.beneficio}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
