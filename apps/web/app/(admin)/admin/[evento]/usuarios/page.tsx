import { getEventoBySlug } from "@/lib/admin/eventos";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateUsuarioDialog } from "./create-usuario-dialog";
import type { SponsorOption, UsuarioRow } from "./types";
import { UsuariosTable } from "./usuarios-table";

type SponsorUsuarioQuery = {
  id: string;
  nombre: string | null;
  cargo: string | null;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  sponsor_id: string;
  sponsors: { id: string; nombre: string; evento_id: string } | null;
};

function formatLastSignIn(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

export default async function UsuariosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento } = await getEventoBySlug(slug);
  const admin = createAdminClient();

  const [{ data: rows, error: rowsError }, { data: sponsorsData, error: sponsorsError }] =
    await Promise.all([
      admin
        .from("sponsor_usuarios")
        .select(
          "id, nombre, cargo, telefono, notas, activo, sponsor_id, sponsors!inner(id, nombre, evento_id)",
        )
        .eq("rol", "sponsor")
        .eq("sponsors.evento_id", evento.id)
        .order("created_at", { ascending: false }),
      admin
        .from("sponsors")
        .select("id, nombre")
        .eq("evento_id", evento.id)
        .order("nombre"),
    ]);

  if (rowsError) {
    throw new Error(rowsError.message);
  }
  if (sponsorsError) {
    throw new Error(sponsorsError.message);
  }

  const baseRows = (rows ?? []) as unknown as SponsorUsuarioQuery[];
  const authResults = await Promise.all(
    baseRows.map((row) => admin.auth.admin.getUserById(row.id)),
  );

  const usuarios: UsuarioRow[] = baseRows.map((row, index) => {
    const authUser = authResults[index]?.data?.user;
    const sponsor = row.sponsors;
    return {
      id: row.id,
      nombre: row.nombre,
      cargo: row.cargo,
      telefono: row.telefono,
      notas: row.notas,
      activo: row.activo,
      sponsorId: row.sponsor_id,
      sponsorNombre: sponsor?.nombre ?? "—",
      email: authUser?.email ?? null,
      lastSignInAt: formatLastSignIn(authUser?.last_sign_in_at),
    };
  });

  const sponsors: SponsorOption[] = (sponsorsData ?? []).map((s) => ({
    id: s.id as string,
    nombre: s.nombre as string,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuentas sponsor del evento activo
          </p>
        </div>
        <CreateUsuarioDialog
          eventoId={evento.id}
          slug={evento.slug}
          sponsors={sponsors}
        />
      </div>

      {usuarios.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Este evento aún no tiene usuarios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el primero con el botón &quot;+ Crear usuario&quot;.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <UsuariosTable
            usuarios={usuarios}
            sponsors={sponsors}
            eventoId={evento.id}
            slug={evento.slug}
          />
        </div>
      )}
    </div>
  );
}
