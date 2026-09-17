import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import {
  iconoCategoria,
  loadPortalBeneficios,
  requiereAccion,
} from "@/lib/portal/beneficios";
import { Button } from "@/components/ui/button";

function EstadoBadge({
  nombre,
  color,
}: {
  nombre: string | null;
  color: string | null;
}) {
  if (!nombre) {
    return (
      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Pendiente
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: color ?? undefined,
        backgroundColor: color ? `${color}20` : undefined,
      }}
    >
      {nombre}
    </span>
  );
}

export default async function RecursosPage() {
  const [{ supabase }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  const beneficios = await loadPortalBeneficios(supabase, sponsor.sponsorId);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
      <div>
        <Link
          href="/portal/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Tus beneficios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completa lo que ColombiaTech necesita para activar cada beneficio de
          tu paquete.
        </p>
      </div>

      {beneficios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-medium">Todavía no hay beneficios para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            En cuanto el equipo de ColombiaTech configure tu paquete, verás
            aquí una tarjeta por cada beneficio.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {beneficios.map((item) => (
            <article
              key={item.compromisoId}
              className="flex flex-col rounded-xl border border-border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span aria-hidden className="mr-1.5">
                    {iconoCategoria(item.categoria)}
                  </span>
                  {item.categoria}
                </p>
                <EstadoBadge
                  nombre={
                    item.tipo === "branding" && item.logoCargado
                      ? "Cargado"
                      : item.estadoNombre
                  }
                  color={
                    item.tipo === "branding" && item.logoCargado
                      ? "#16a34a"
                      : item.estadoColor
                  }
                />
              </div>
              <h2 className="mt-3 text-lg font-semibold leading-snug">
                {item.beneficio}
              </h2>

              {requiereAccion(item.tipo) ? (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#42B3F3] transition-all"
                      style={{ width: `${item.progreso.pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {item.progreso.label}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  {item.progreso.label}
                </p>
              )}

              <div className="mt-auto pt-5">
                <Button asChild className="w-full">
                  <Link href={`/portal/recursos/${item.compromisoId}`}>
                    {item.progreso.completed || !requiereAccion(item.tipo)
                      ? "Ver detalle"
                      : "Completar"}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
