import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import { INSUMOS_REQUERIDOS } from "@/lib/portal/insumos";
import { DownloadButton } from "../dashboard/download-button";
import { InsumosUploader } from "./insumos-uploader";

type Archivo = {
  id: string;
  direccion: "sponsor_sube" | "ctw_entrega";
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
};

export default async function RecursosPage() {
  const [{ supabase, user }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  const { data, error } = await supabase
    .from("archivos")
    .select("id, direccion, tipo, nombre_archivo, storage_path, created_at")
    .eq("sponsor_id", sponsor.sponsorId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const archivos = (data ?? []) as Archivo[];
  const sponsorSube = archivos.filter((item) => item.direccion === "sponsor_sube");
  const ctEntrega = archivos.filter((item) => item.direccion === "ctw_entrega");
  const subidos = Array.from(new Set(sponsorSube.map((item) => item.tipo)));

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <div>
        <Link
          href="/portal/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Recursos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube los insumos que ColombiaTech necesita y descarga los entregables
          que el equipo preparó para ti.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Subir insumos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos son los insumos requeridos. Adjunta un archivo para cada uno.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-white px-5">
          <InsumosUploader
            sponsorId={sponsor.sponsorId}
            userId={user.id}
            insumos={INSUMOS_REQUERIDOS}
            subidos={subidos}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Descargar de CT</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entregables que el equipo de ColombiaTech preparó para ti.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-white p-5">
          <ul className="divide-y divide-border">
            {ctEntrega.length === 0 ? (
              <li className="py-4 text-sm text-muted-foreground">
                CT aún no ha publicado archivos.
              </li>
            ) : (
              ctEntrega.map((archivo) => (
                <li key={archivo.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{archivo.nombre_archivo}</p>
                    <p className="text-xs text-muted-foreground">{archivo.tipo}</p>
                  </div>
                  <DownloadButton
                    path={archivo.storage_path}
                    filename={archivo.nombre_archivo}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
