import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogoTable } from "./catalogo-table";

export type CatalogAsset = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costoCreditos: number;
  activo: boolean;
};

export default async function CatalogoMediaPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("media_assets_catalogo")
    .select("id, nombre, descripcion, costo_creditos, activo")
    .order("nombre");

  if (error) throw new Error(error.message);

  const assets: CatalogAsset[] = (data ?? []).map((a) => ({
    id: a.id as string,
    nombre: a.nombre as string,
    descripcion: (a.descripcion as string | null) ?? null,
    costoCreditos: a.costo_creditos as number,
    activo: a.activo as boolean,
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Catálogo Media</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Assets disponibles para activar en ciclos de clientes
      </p>
      <CatalogoTable assets={assets} />
    </div>
  );
}
