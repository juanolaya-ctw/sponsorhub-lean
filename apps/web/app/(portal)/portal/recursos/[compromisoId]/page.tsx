import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSponsor } from "@/lib/auth/require-admin";
import { getSponsorContext } from "@/lib/portal/sponsor";
import {
  ARCHIVOS_BUCKET,
  iconoCategoria,
  isImageName,
  isStoredObject,
  loadPortalBeneficio,
  parseNewsletter,
  TIPO_NEWSLETTER,
  TIPO_SPEAKER_FORM,
} from "@/lib/portal/beneficios";
import { AccesosForm } from "./accesos-form";
import { BrandingForm } from "./branding-form";
import { NewsletterForm } from "./newsletter-form";
import { SpeakerForm } from "./speaker-form";

export default async function BeneficioDetallePage({
  params,
}: {
  params: Promise<{ compromisoId: string }>;
}) {
  const { compromisoId } = await params;
  const [{ supabase, user }, sponsor] = await Promise.all([
    requireSponsor(),
    getSponsorContext(),
  ]);

  const beneficio = await loadPortalBeneficio(
    supabase,
    sponsor.sponsorId,
    compromisoId,
  );
  if (!beneficio) notFound();

  const archivosConUrl = await Promise.all(
    beneficio.archivos.map(async (archivo) => {
      if (!isStoredObject(archivo.storage_path)) {
        return { ...archivo, viewUrl: null };
      }
      const { data } = await supabase.storage
        .from(ARCHIVOS_BUCKET)
        .createSignedUrl(archivo.storage_path, 60 * 60);
      return { ...archivo, viewUrl: data?.signedUrl ?? null };
    }),
  );

  const logoArchivo =
    archivosConUrl.find((item) => isStoredObject(item.storage_path)) ?? null;
  const newsletterArchivo =
    archivosConUrl.find((item) => item.tipo === TIPO_NEWSLETTER) ??
    archivosConUrl[0] ??
    null;
  const newsletter = newsletterArchivo
    ? parseNewsletter(newsletterArchivo.nombre_archivo)
    : null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <div>
        <Link
          href="/portal/recursos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a beneficios
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          <span aria-hidden className="mr-1.5">
            {iconoCategoria(beneficio.categoria)}
          </span>
          {beneficio.categoria}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{beneficio.beneficio}</h1>
      </div>

      {beneficio.detalleSolicitud ? (
        <section className="rounded-xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold">Instrucciones</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {beneficio.detalleSolicitud}
          </p>
          {beneficio.notas ? (
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              {beneficio.notas}
            </p>
          ) : null}
        </section>
      ) : null}

      {beneficio.tipo === "branding" ? (
        <BrandingForm
          sponsorId={sponsor.sponsorId}
          userId={user.id}
          compromisoId={beneficio.compromisoId}
          archivo={
            logoArchivo
              ? {
                  id: logoArchivo.id,
                  nombre: logoArchivo.nombre_archivo,
                  storagePath: logoArchivo.storage_path,
                  viewUrl: logoArchivo.viewUrl,
                  isImage: isImageName(logoArchivo.nombre_archivo),
                }
              : null
          }
        />
      ) : null}

      {beneficio.tipo === "accesos" ? (
        <AccesosForm
          sponsorId={sponsor.sponsorId}
          compromisoId={beneficio.compromisoId}
          categoria={beneficio.categoria}
          cantidad={beneficio.cantidad}
          personas={beneficio.personas}
        />
      ) : null}

      {beneficio.tipo === "newsletter" ? (
        <NewsletterForm
          sponsorId={sponsor.sponsorId}
          userId={user.id}
          compromisoId={beneficio.compromisoId}
          initial={newsletter}
          archivo={
            newsletterArchivo && isStoredObject(newsletterArchivo.storage_path)
              ? {
                  id: newsletterArchivo.id,
                  nombre: newsletterArchivo.nombre_archivo,
                  storagePath: newsletterArchivo.storage_path,
                  viewUrl: newsletterArchivo.viewUrl,
                }
              : newsletterArchivo
                ? {
                    id: newsletterArchivo.id,
                    nombre: newsletterArchivo.nombre_archivo,
                    storagePath: newsletterArchivo.storage_path,
                    viewUrl: null,
                  }
                : null
          }
        />
      ) : null}

      {beneficio.tipo === "speaker" ? (
        <SpeakerForm
          sponsorId={sponsor.sponsorId}
          userId={user.id}
          compromisoId={beneficio.compromisoId}
          completado={beneficio.progreso.completed}
          archivoId={
            beneficio.archivos.find((item) => item.tipo === TIPO_SPEAKER_FORM)
              ?.id ?? null
          }
        />
      ) : null}

      {beneficio.tipo === "informativo" ? (
        <section className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm leading-relaxed">
            Este beneficio no requiere acción de tu parte. El equipo de
            ColombiaTech te contactará con los detalles.
          </p>
        </section>
      ) : null}
    </main>
  );
}
