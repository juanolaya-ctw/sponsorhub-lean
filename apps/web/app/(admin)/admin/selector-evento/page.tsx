import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Evento, EventoEstado } from "@/lib/admin/eventos";
import { createClient } from "@/lib/supabase/server";

const ESTADO_LABEL: Record<EventoEstado, string> = {
  planificacion: "Planificación",
  activo: "Activo",
  cerrado: "Cerrado",
};

function formatFecha(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

export default async function SelectorEventoPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select("id, slug, nombre, fecha_inicio, fecha_fin, estado")
    .order("fecha_inicio", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const eventos = (data ?? []) as Evento[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige el evento que quieres gestionar.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/crear-evento">+ Nuevo evento</Link>
        </Button>
      </div>

      {eventos.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
          <p className="font-medium">No hay eventos todavía</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando exista un evento en SponsorHub, aparecerá aquí como tarjeta
            para entrar a su panel.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link
                href={`/admin/${evento.slug}/sponsors`}
                className="block rounded-xl border border-border bg-white p-5 transition-colors hover:border-secondary hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{evento.nombre}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {ESTADO_LABEL[evento.estado] ?? evento.estado}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{evento.slug}</p>
                <p className="mt-4 text-sm">
                  {formatFecha(evento.fecha_inicio)} — {formatFecha(evento.fecha_fin)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
