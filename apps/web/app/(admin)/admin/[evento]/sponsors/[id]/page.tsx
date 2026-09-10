import { getEventoBySlug } from "@/lib/admin/eventos";

export default async function SponsorDetallePlaceholder({
  params,
}: {
  params: Promise<{ evento: string; id: string }>;
}) {
  const { evento: slug } = await params;
  const { evento } = await getEventoBySlug(slug);

  return (
    <div>
      <h1 className="text-xl font-semibold">Detalle del sponsor</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta vista se construirá en una siguiente tarea. Evento: {evento.nombre}.
      </p>
    </div>
  );
}
