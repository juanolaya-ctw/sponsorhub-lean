import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { NuevoClienteForm } from "./nuevo-cliente-form";

export default async function NuevoClienteMediaPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: sponsorsData } = await admin
    .from("sponsors")
    .select("id, nombre")
    .order("nombre");

  const sponsors = (sponsorsData ?? []).map((s) => ({
    id: s.id as string,
    label: s.nombre as string,
  }));

  return (
    <div className="max-w-lg">
      <Link
        href="/admin/media"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a clientes
      </Link>
      <h1 className="mb-6 text-xl font-semibold">Nuevo cliente media</h1>
      <NuevoClienteForm sponsors={sponsors} />
    </div>
  );
}
