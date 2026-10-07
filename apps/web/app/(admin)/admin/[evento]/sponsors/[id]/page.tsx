import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEventoBySlug } from "@/lib/admin/eventos";
import { GOVTECH_EVENT_SLUG } from "@/lib/notion/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBeneficioInsumoCompleto,
  isStoredObject,
  loadPortalBeneficios,
  parseNewsletter,
  requiereAccion,
  TIPO_FORMULARIO_URL,
} from "@/lib/portal/beneficios";
import { EntregablesCtSection } from "./entregables-ct";
import { InsumosAdminList } from "./insumos-admin-list";
import {
  BeneficiosSection,
  type BeneficioCompromisoRow,
} from "./beneficios-section";
import type { FormularioPorSponsor } from "./formulario-link-por-sponsor";
import {
  CommitmentsTable,
  type CompromisoRow,
  type EstadoOption,
} from "../../compromisos/commitments-table";
import { DeleteSponsorButton } from "../delete-sponsor-button";
import { TierSelect } from "../tier-select";
import { CtMediaToggle } from "../ct-media-toggle";
import type { ArchivoPorSponsor } from "./upload-por-sponsor";

const BUCKET = "sponsorhub-archivos";
const SIGNED_URL_TTL = 60 * 60; // 1 hora

type SponsorDetalle = {
  id: string;
  nombre: string;
  paquete: string | null;
  ct_media: boolean;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
};

type ArchivoSponsor = {
  id: string;
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
  compromiso_id: string | null;
};

type AccesoPersonaAdmin = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  documento_identidad: string | null;
  linkedin_url: string | null;
  rol_ecosistema: string | null;
  numero_celular: string | null;
  pais_residencia: string | null;
  empresa: string | null;
  industria: string | null;
  nivel_cargo: string | null;
  cargo: string | null;
  tipo: string;
};

function isRealFile(archivo: ArchivoSponsor): boolean {
  return isStoredObject(archivo.storage_path);
}

/** Nombre de descarga legible cuando nombre_archivo es JSON (newsletter). */
function downloadFilename(archivo: ArchivoSponsor): string {
  if (parseNewsletter(archivo.nombre_archivo)) {
    const ext = archivo.storage_path.match(/\.[a-z0-9]+$/i)?.[0] ?? ".png";
    return `newsletter-${archivo.id}${ext}`;
  }
  return archivo.nombre_archivo;
}

export default async function SponsorDetallePage({
  params,
}: {
  params: Promise<{ evento: string; id: string }>;
}) {
  const { evento: slug, id } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const { data: sponsorData, error: sponsorError } = await supabase
    .from("sponsors")
    .select(
      "id, nombre, paquete, ct_media, contacto_nombre, contacto_email, contacto_telefono",
    )
    .eq("id", id)
    .eq("evento_id", evento.id)
    .maybeSingle();

  if (sponsorError) throw new Error(sponsorError.message);
  if (!sponsorData) notFound();
  const sponsor = sponsorData as SponsorDetalle;

  const [
    archivosResult,
    entregasResult,
    compromisosResult,
    estadosResult,
    tiersResult,
    accesosResult,
    archivosBeneficioResult,
    formulariosEventoResult,
  ] = await Promise.all([
    supabase
      .from("archivos")
      .select("id, tipo, nombre_archivo, storage_path, created_at, compromiso_id")
      .eq("sponsor_id", sponsor.id)
      .in("direccion", ["sponsor_sube", "admin_sube_por_sponsor"])
      .order("created_at", { ascending: false }),
    supabase
      .from("archivos")
      .select("id, tipo, nombre_archivo, storage_path, created_at, compromiso_id")
      .eq("sponsor_id", sponsor.id)
      .eq("direccion", "ctw_entrega")
      .order("created_at", { ascending: false }),
    supabase
      .from("compromisos")
      .select(
        "id, tipo, tipo_beneficio, categoria_beneficio, notion_page_id, fecha_limite, estado_id, sponsors(nombre), catalogo_beneficios(beneficio)",
      )
      .eq("sponsor_id", sponsor.id)
      .order("fecha_limite"),
    supabase
      .from("estados_compromiso")
      .select("id, nombre, color")
      .or(`evento_id.eq.${evento.id},evento_id.is.null`)
      .order("orden"),
    supabase
      .from("catalogo_beneficios")
      .select("tier")
      .eq("evento_id", evento.id)
      .order("tier"),
    supabase
      .from("accesos_personas")
      .select(
        "id, nombre, apellido, email, documento_identidad, linkedin_url, rol_ecosistema, numero_celular, pais_residencia, empresa, industria, nivel_cargo, cargo, tipo",
      )
      .eq("sponsor_id", sponsor.id)
      .order("created_at"),
    supabase
      .from("archivos")
      .select("id, tipo, compromiso_id, nombre_archivo, storage_path, created_at")
      .eq("sponsor_id", sponsor.id)
      .in("direccion", ["sponsor_sube", "admin_sube_por_sponsor"])
      .not("compromiso_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("beneficio_formularios")
      .select("beneficio_nombre, url")
      .eq("evento_id", evento.id),
  ]);

  if (archivosResult.error) throw new Error(archivosResult.error.message);
  if (entregasResult.error) throw new Error(entregasResult.error.message);
  if (compromisosResult.error) throw new Error(compromisosResult.error.message);
  if (estadosResult.error) throw new Error(estadosResult.error.message);
  if (tiersResult.error) throw new Error(tiersResult.error.message);
  if (accesosResult.error) throw new Error(accesosResult.error.message);
  if (archivosBeneficioResult.error) {
    throw new Error(archivosBeneficioResult.error.message);
  }
  if (
    formulariosEventoResult.error &&
    formulariosEventoResult.error.code !== "42P01"
  ) {
    throw new Error(formulariosEventoResult.error.message);
  }
  const formulariosEventoPorNombre = new Map(
    (formulariosEventoResult.data ?? []).map((row) => [
      row.beneficio_nombre as string,
      row.url as string,
    ]),
  );

  const archivosData = archivosResult.data;
  const archivos = (archivosData ?? []) as ArchivoSponsor[];
  const entregas = (entregasResult.data ?? []) as ArchivoSponsor[];
  const compromisos = (compromisosResult.data ?? []) as unknown as CompromisoRow[];
  const beneficiosGovtech = (compromisosResult.data ??
    []) as unknown as BeneficioCompromisoRow[];
  const estados = (estadosResult.data ?? []) as EstadoOption[];
  const isGovtech = evento.slug === GOVTECH_EVENT_SLUG;
  const accesos = (accesosResult.data ?? []) as AccesoPersonaAdmin[];
  const tiers = Array.from(
    new Set((tiersResult.data ?? []).map((item) => item.tier)),
  );

  // Más reciente por compromiso; preferir archivo real sobre markers JSON.
  const archivosPorCompromiso = new Map<string, ArchivoPorSponsor>();
  const formulariosPorCompromiso = new Map<string, FormularioPorSponsor>();
  for (const row of archivosBeneficioResult.data ?? []) {
    const compromisoId = row.compromiso_id as string | null;
    if (!compromisoId) continue;

    if (
      row.tipo === TIPO_FORMULARIO_URL &&
      /^https?:\/\//i.test(row.storage_path as string)
    ) {
      if (!formulariosPorCompromiso.has(compromisoId)) {
        formulariosPorCompromiso.set(compromisoId, {
          id: row.id as string,
          url: row.storage_path as string,
        });
      }
      continue;
    }

    const candidate: ArchivoPorSponsor = {
      id: row.id as string,
      nombre: row.nombre_archivo as string,
      storagePath: row.storage_path as string,
    };
    const existing = archivosPorCompromiso.get(compromisoId);
    if (!existing) {
      archivosPorCompromiso.set(compromisoId, candidate);
      continue;
    }
    const existingReal = isStoredObject(existing.storagePath);
    const candidateReal = isStoredObject(candidate.storagePath);
    if (!existingReal && candidateReal) {
      archivosPorCompromiso.set(compromisoId, candidate);
    }
  }

  // Las URLs firmadas se generan con el cliente de service_role porque las
  // policies de Storage solo dan acceso al propio sponsor. Esta página está
  // detrás de requireAdmin (getEventoBySlug), así que el acceso ya está
  // validado. Se recalcula en cada carga — sin tiempo real.
  const admin = createAdminClient();
  const archivosConUrl = await Promise.all(
    archivos.map(async (archivo) => {
      const realFile = isRealFile(archivo);
      if (!realFile) {
        return {
          ...archivo,
          realFile,
          viewUrl: /^https?:\/\//i.test(archivo.storage_path)
            ? archivo.storage_path
            : null,
          downloadUrl: null,
        };
      }
      const filename = downloadFilename(archivo);
      const [viewResult, downloadResult] = await Promise.all([
        admin.storage
          .from(BUCKET)
          .createSignedUrl(archivo.storage_path, SIGNED_URL_TTL),
        admin.storage
          .from(BUCKET)
          .createSignedUrl(archivo.storage_path, SIGNED_URL_TTL, {
            download: filename,
          }),
      ]);
      return {
        ...archivo,
        realFile,
        viewUrl: viewResult.data?.signedUrl ?? null,
        downloadUrl: downloadResult.data?.signedUrl ?? null,
      };
    }),
  );
  // Misma fuente que la tabla Beneficios: todos los compromisos del sponsor.
  // Los que requieren formulario del portal se completan con archivos/personas;
  // informativos/addons, con estado final en el panel.
  const beneficiosPortal = await loadPortalBeneficios(supabase, sponsor.id);
  const insumosFaltantes = beneficiosPortal.filter(
    (item) => !isBeneficioInsumoCompleto(item),
  );
  const totalInsumos = beneficiosPortal.length;
  const completados = totalInsumos - insumosFaltantes.length;
  const progreso =
    totalInsumos === 0 ? 100 : Math.round((completados / totalInsumos) * 100);

  const entregasConUrl = await Promise.all(
    entregas.map(async (archivo) => {
      if (!isStoredObject(archivo.storage_path)) {
        const isUrl = /^https?:\/\//i.test(archivo.storage_path);
        return {
          id: archivo.id,
          tipo: archivo.tipo,
          nombre: archivo.nombre_archivo,
          storagePath: archivo.storage_path,
          createdAt: archivo.created_at,
          viewUrl: isUrl ? archivo.storage_path : null,
          downloadUrl: null,
        };
      }
      const [viewResult, downloadResult] = await Promise.all([
        admin.storage
          .from(BUCKET)
          .createSignedUrl(archivo.storage_path, SIGNED_URL_TTL),
        admin.storage
          .from(BUCKET)
          .createSignedUrl(archivo.storage_path, SIGNED_URL_TTL, {
            download: archivo.nombre_archivo,
          }),
      ]);
      return {
        id: archivo.id,
        tipo: archivo.tipo,
        nombre: archivo.nombre_archivo,
        storagePath: archivo.storage_path,
        createdAt: archivo.created_at,
        viewUrl: viewResult.data?.signedUrl ?? null,
        downloadUrl: downloadResult.data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/${evento.slug}/sponsors`}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a sponsors
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{sponsor.nombre}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{evento.nombre}</p>
            {sponsor.contacto_nombre ||
            sponsor.contacto_email ||
            sponsor.contacto_telefono ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {[
                  sponsor.contacto_nombre,
                  sponsor.contacto_email,
                  sponsor.contacto_telefono,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <TierSelect
              sponsorId={sponsor.id}
              eventoSlug={evento.slug}
              currentTier={sponsor.paquete}
              tiers={tiers}
            />
            <CtMediaToggle
              sponsorId={sponsor.id}
              eventoSlug={evento.slug}
              enabled={sponsor.ct_media === true}
            />
            <DeleteSponsorButton
              sponsorId={sponsor.id}
              sponsorNombre={sponsor.nombre}
              eventoSlug={evento.slug}
              redirectAfterDelete
            />
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Insumos del sponsor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Despliega cada beneficio para ver textos e imágenes juntos (newsletter,
          LinkedIn/Instagram, logos, etc.).
        </p>

        <div className="mt-4 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">Información completada</span>
            <span className="text-muted-foreground">
              {completados}/{totalInsumos} · {progreso}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-secondary transition-[width]"
              style={{ width: `${progreso}%` }}
            />
          </div>

          {totalInsumos === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Este sponsor no tiene beneficios sincronizados.
            </p>
          ) : insumosFaltantes.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium">Insumos faltantes</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {insumosFaltantes.map((insumo) => (
                  <li
                    key={insumo.compromisoId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{insumo.beneficio}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {insumo.categoria}
                        {" · "}
                        {requiereAccion(insumo.tipo)
                          ? insumo.progreso.label
                          : insumo.estadoNombre
                            ? `Estado: ${insumo.estadoNombre}`
                            : "Sin estado final"}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Pendiente
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#16a34a]">
              Todos los insumos requeridos están completos.
            </p>
          )}
        </div>

        <InsumosAdminList
          archivos={archivosConUrl.map((archivo) => ({
            id: archivo.id,
            tipo: archivo.tipo,
            nombre_archivo: archivo.nombre_archivo,
            storage_path: archivo.storage_path,
            created_at: archivo.created_at,
            compromiso_id: archivo.compromiso_id,
            realFile: archivo.realFile,
            viewUrl: archivo.viewUrl,
            downloadUrl: archivo.downloadUrl,
          }))}
          sponsorId={sponsor.id}
          eventoSlug={evento.slug}
        />
      </section>

      <EntregablesCtSection
        sponsorId={sponsor.id}
        eventoSlug={evento.slug}
        archivos={entregasConUrl}
      />

      <section>
        <h2 className="text-lg font-semibold">Accesos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personas registradas por el sponsor para accesos generales y VIP.
        </p>
        {accesos.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
            <p className="font-medium">Este sponsor aún no ha registrado personas</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Rol ecosistema</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Industria</TableHead>
                  <TableHead>Nivel de cargo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accesos.map((persona) => {
                  const nombre = [persona.nombre, persona.apellido]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <TableRow key={persona.id}>
                      <TableCell className="capitalize">{persona.tipo}</TableCell>
                      <TableCell className="font-medium">{nombre || "—"}</TableCell>
                      <TableCell>{persona.documento_identidad ?? "—"}</TableCell>
                      <TableCell>{persona.email ?? "—"}</TableCell>
                      <TableCell>
                        {persona.linkedin_url ? (
                          <a
                            href={persona.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-secondary hover:underline"
                          >
                            Ver perfil
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{persona.rol_ecosistema ?? "—"}</TableCell>
                      <TableCell>{persona.numero_celular ?? "—"}</TableCell>
                      <TableCell>{persona.pais_residencia ?? "—"}</TableCell>
                      <TableCell>{persona.empresa ?? "—"}</TableCell>
                      <TableCell>{persona.industria ?? "—"}</TableCell>
                      <TableCell>
                        {persona.nivel_cargo ?? persona.cargo ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {isGovtech ? (
        <BeneficiosSection
          compromisos={beneficiosGovtech}
          estados={estados}
          eventoId={evento.id}
          eventoSlug={evento.slug}
          sponsorId={sponsor.id}
          archivosPorCompromiso={archivosPorCompromiso}
          formulariosPorCompromiso={formulariosPorCompromiso}
          formulariosEventoPorNombre={formulariosEventoPorNombre}
        />
      ) : (
        <section>
          <h2 className="text-lg font-semibold">Compromisos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Beneficios, estados y fechas límite de este sponsor.
          </p>
          {compromisos.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
              <p className="font-medium">Este sponsor no tiene compromisos</p>
            </div>
          ) : (
            <div className="mt-4">
              <CommitmentsTable
                compromisos={compromisos}
                estados={estados}
                eventoSlug={evento.slug}
                showSponsor={false}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
