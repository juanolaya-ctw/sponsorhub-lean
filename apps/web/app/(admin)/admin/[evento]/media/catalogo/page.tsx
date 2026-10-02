import { getEventoBySlug } from "@/lib/admin/eventos";
import { createAdminClient } from "@/lib/supabase/admin";
import { CatalogoTable } from "./catalogo-table";

export type CatalogAsset = {
  id: string;
  nombre: string;
  descripcion: string | null;
  costoCreditos: number;
  activo: boolean;
};

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  await getEventoBySlug(slug);
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
      <div>
        <h1 className="text-xl font-semibold">Catálogo Media</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assets disponibles para activar en ciclos de sponsors
        </p>
      </div>
      <div className="mt-6">
        <CatalogoTable assets={assets} slug={slug} />
      </div>
    </div>
  );
}
