import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SponsorConEvento } from "@/lib/admin/create-usuario-guards";
import type { Evento, EventoEstado } from "@/lib/admin/eventos";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  IniciarAccesoMediaPanel,
  type MediaClienteOption,
} from "./iniciar-acceso-media";
import { IniciarCrearUsuarioPanel } from "./iniciar-crear-usuario";

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

type SponsorEventoJoin = {
  id: string;
  nombre: string;
  evento_id: string;
  eventos:
    | { id: string; slug: string; nombre: string }
    | { id: string; slug: string; nombre: string }[]
    | null;
};

export default async function SelectorEventoPage() {
  await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    { data, error },
    { data: sponsorsData, error: sponsorsError },
    { data: mediaClientesData, error: mediaClientesError },
  ] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, slug, nombre, fecha_inicio, fecha_fin, estado")
      .order("fecha_inicio", { ascending: false }),
    admin
      .from("sponsors")
      .select("id, nombre, evento_id, eventos!inner(id, slug, nombre)")
      .order("nombre"),
    admin
      .from("media_clientes")
      .select("id, nombre, empresa")
      .eq("activo", true)
      .order("empresa"),
  ]);

  if (error) {
    throw new Error(error.message);
  }
  if (sponsorsError) {
    throw new Error(sponsorsError.message);
  }
  if (mediaClientesError) {
    throw new Error(mediaClientesError.message);
  }

  const eventos = (data ?? []) as Evento[];
  const sponsors: SponsorConEvento[] = ((sponsorsData ?? []) as SponsorEventoJoin[])
    .map((row) => {
      const evento = Array.isArray(row.eventos) ? row.eventos[0] : row.eventos;
      if (!evento) return null;
      return {
        id: row.id,
        nombre: row.nombre,
        eventoId: row.evento_id,
        eventoSlug: evento.slug,
        eventoNombre: evento.nombre,
      };
    })
    .filter((row): row is SponsorConEvento => row !== null);

  const mediaClientes: MediaClienteOption[] = (mediaClientesData ?? []).map(
    (row) => {
      const empresa = ((row.empresa as string | null) ?? "").trim();
      const nombre = ((row.nombre as string | null) ?? "").trim();
      return {
        id: row.id as string,
        label: empresa || nombre || (row.id as string),
      };
    },
  );

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

      <section className="mt-8 space-y-6 rounded-xl border border-border bg-white p-5">
        <div>
          <h2 className="font-semibold">Gestión de usuarios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrada unificada: eventos (sponsors) y Media (contactos). Reutiliza
            los flujos y permisos existentes; no hay un segundo listado de
            usuarios.
          </p>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Eventos — usuario portal sponsor</h3>
          <p className="text-xs text-muted-foreground">
            Elige un sponsor; se abre la creación en la vista de usuarios de su
            evento.
          </p>
          <IniciarCrearUsuarioPanel sponsors={sponsors} />
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">
            Media — contactos y acceso portal
          </h3>
          <p className="text-xs text-muted-foreground">
            Elige la empresa; se abre la ficha CT Media con alta, vínculo y
            generación de enlace del contacto.
          </p>
          <IniciarAccesoMediaPanel clientes={mediaClientes} />
        </div>
      </section>

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

      {/* Workspaces transversales */}
      <div className="mt-12">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Workspaces
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          <li>
            <Link
              href="/admin/media"
              className="block rounded-xl border border-border bg-white p-5 transition-colors hover:border-secondary hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">CT Media</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Activo
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Clientes, planes y assets de media táctica
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Transversal a todos los eventos
              </p>
            </Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
