import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanesTable } from "./planes-table";

export type MediaPlan = {
  id: string;
  nombre: string;
  creditosMensuales: number;
  precioUsd: number;
  activo: boolean;
};

export default async function PlanesMediaPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("media_planes")
    .select("id, nombre, creditos_mensuales, precio_usd, activo")
    .order("creditos_mensuales");

  if (error) throw new Error(error.message);

  const planes: MediaPlan[] = (data ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    creditosMensuales: p.creditos_mensuales as number,
    precioUsd: p.precio_usd as number,
    activo: p.activo as boolean,
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Planes Media</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Configuración de planes de créditos mensuales
      </p>
      <PlanesTable planes={planes} />
    </div>
  );
}
