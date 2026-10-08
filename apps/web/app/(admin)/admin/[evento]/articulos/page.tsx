import { getEventoBySlug } from "@/lib/admin/eventos";
import {
  ARCHIVOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type ArticuloRow,
  type ArticuloSponsorCard,
} from "@/lib/admin/articulos";
import {
  buildInsumoPrefillFromArchivos,
  isLikelyHttpImageUrl,
  isLinkedInInsumoTipo,
  type ArchivoInsumoRow,
} from "@/lib/admin/articulos-insumos";
import { resolveStaticSponsorLogos } from "@/lib/admin/sponsor-logos-static";
import {
  isImageName,
  isLogoTipo,
  isStoredObject,
} from "@/lib/portal/beneficios";
import { ArticulosClient } from "./articulos-client";

type SponsorRow = {
  id: string;
  nombre: string;
  paquete: string | null;
  logo_url: string | null;
};

function isLogoArchivo(row: ArchivoInsumoRow): boolean {
  if (isLogoTipo(row.tipo)) return true;
  return /logo/i.test(row.tipo) || /logo/i.test(row.nombre_archivo);
}

async function signedUrl(
  supabase: Awaited<ReturnType<typeof getEventoBySlug>>["supabase"],
  path: string | null | undefined,
): Promise<string | null> {
  if (!path || !isStoredObject(path)) return null;
  const { data } = await supabase.storage
    .from(ARCHIVOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export default async function ArticulosPage({
  params,
}: {
  params: Promise<{ evento: string }>;
}) {
  const { evento: slug } = await params;
  const { evento, supabase } = await getEventoBySlug(slug);

  const { data: sponsorsData, error: sponsorsError } = await supabase
    .from("sponsors")
    .select("id, nombre, paquete, logo_url")
    .eq("evento_id", evento.id)
    .order("nombre");

  if (sponsorsError) {
    throw new Error(sponsorsError.message);
  }

  const sponsors = (sponsorsData ?? []) as SponsorRow[];
  const sponsorIds = sponsors.map((s) => s.id);

  let articulosData: ArticuloRow[] = [];
  let archivosData: ArchivoInsumoRow[] = [];

  if (sponsorIds.length > 0) {
    // Sin filtro de tipo: igual que insumos del sponsor detail.
    // Así capturamos linkedin_instagram, info_redes, logos con tipado raro, etc.
    const [articulosRes, archivosRes] = await Promise.all([
      supabase.from("articulos").select("*").eq("evento_id", evento.id),
      supabase
        .from("archivos")
        .select("sponsor_id, storage_path, tipo, nombre_archivo, created_at")
        .in("sponsor_id", sponsorIds)
        .order("created_at", { ascending: false }),
    ]);

    if (articulosRes.error) {
      throw new Error(articulosRes.error.message);
    }
    if (archivosRes.error) {
      throw new Error(archivosRes.error.message);
    }
    articulosData = (articulosRes.data ?? []) as ArticuloRow[];
    archivosData = (archivosRes.data ?? []) as ArchivoInsumoRow[];
  }

  const articuloBySponsor = new Map<string, ArticuloRow>();
  for (const row of articulosData) {
    if (!articuloBySponsor.has(row.sponsor_id)) {
      articuloBySponsor.set(row.sponsor_id, row);
    }
  }

  const archivosBySponsor = new Map<string, ArchivoInsumoRow[]>();
  for (const row of archivosData) {
    const list = archivosBySponsor.get(row.sponsor_id) ?? [];
    list.push(row);
    archivosBySponsor.set(row.sponsor_id, list);
  }

  const pathsToSign = new Set<string>();
  for (const rows of archivosBySponsor.values()) {
    for (const row of rows) {
      if (!isStoredObject(row.storage_path)) continue;
      if (isLogoArchivo(row)) {
        // Incluir aunque la extensión no sea imagen (intentamos signed URL;
        // el <img> hace fallback si falla).
        if (
          isImageName(row.nombre_archivo) ||
          isImageName(row.storage_path) ||
          /\.(png|jpe?g|webp|gif|svg)$/i.test(row.storage_path)
        ) {
          pathsToSign.add(row.storage_path);
        }
      }
      if (isLinkedInInsumoTipo(row.tipo)) {
        pathsToSign.add(row.storage_path);
      }
    }
  }
  for (const articulo of articulosData) {
    if (articulo.image_source_path) pathsToSign.add(articulo.image_source_path);
    if (articulo.imagen_path) pathsToSign.add(articulo.imagen_path);
  }

  const signedByPath = new Map<string, string | null>();
  await Promise.all(
    Array.from(pathsToSign).map(async (path) => {
      signedByPath.set(path, await signedUrl(supabase, path));
    }),
  );

  const cards: ArticuloSponsorCard[] = sponsors.map((sponsor) => {
    const articulo = articuloBySponsor.get(sponsor.id) ?? null;
    const rows = archivosBySponsor.get(sponsor.id) ?? [];

    const logoRow =
      rows.find(
        (r) =>
          isLogoArchivo(r) &&
          isStoredObject(r.storage_path) &&
          (isImageName(r.nombre_archivo) ||
            isImageName(r.storage_path) ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(r.storage_path)),
      ) ?? null;
    const logoFromStorage = logoRow
      ? (signedByPath.get(logoRow.storage_path) ?? null)
      : null;
    const notionLogo = isLikelyHttpImageUrl(sponsor.logo_url)
      ? sponsor.logo_url
      : null;

    const staticLogos = resolveStaticSponsorLogos(sponsor.nombre);

    const insumoPrefill = articulo
      ? null
      : buildInsumoPrefillFromArchivos(rows, signedByPath);

    const imageSourceUrl =
      (articulo?.image_source_path
        ? (signedByPath.get(articulo.image_source_path) ?? null)
        : null) ??
      insumoPrefill?.image_url ??
      null;

    const imagenPreviewUrl =
      (articulo?.imagen_path
        ? (signedByPath.get(articulo.imagen_path) ?? null)
        : null) ??
      articulo?.imagen_url ??
      null;

    const logoBlanco =
      staticLogos?.blanco ?? logoFromStorage ?? notionLogo ?? null;
    const logoColor =
      staticLogos?.color ?? logoFromStorage ?? staticLogos?.blanco ?? notionLogo ?? null;
    const resolvedLogo =
      logoFromStorage ?? staticLogos?.preview ?? notionLogo ?? null;

    return {
      id: sponsor.id,
      nombre: sponsor.nombre,
      paquete: sponsor.paquete,
      logo_url: sponsor.logo_url,
      logo_preview_url: resolvedLogo,
      logo_blanco_url: logoBlanco,
      logo_color_url: logoColor,
      has_logo_blanco: Boolean(logoBlanco || resolvedLogo),
      articulo,
      image_source_url: imageSourceUrl,
      imagen_preview_url: imagenPreviewUrl,
      insumo_prefill: insumoPrefill,
    };
  });

  return (
    <ArticulosClient
      eventoId={evento.id}
      eventoSlug={evento.slug}
      initialSponsors={cards}
    />
  );
}
