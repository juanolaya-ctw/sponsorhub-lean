import { createAdminClient } from "@/lib/supabase/admin";
import {
  ARCHIVOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type ArticuloRow,
} from "@/lib/admin/articulos";
import { isStoredObject } from "@/lib/portal/beneficios";

export type PublicArticuloDto = {
  id: string;
  slug: string;
  companyName: string;
  logoUrl: string | null;
  tier: string | null;
  categoria: string | null;
  datoImpactante: string;
  articuloTexto: string | null;
  imagenUrl: string | null;
  publishedAt: string | null;
  eventoSlug: string;
};

type EventoRow = {
  id: string;
  slug: string;
};

function appOrigin(requestOrigin?: string | null): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  return "";
}

function absolutizeAssetUrl(
  value: string | null | undefined,
  requestOrigin?: string | null,
): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) {
    const origin = appOrigin(requestOrigin);
    return origin ? `${origin}${value}` : value;
  }
  return value;
}

async function signedStorageUrl(
  admin: ReturnType<typeof createAdminClient>,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path || !isStoredObject(path)) return null;
  const { data, error } = await admin.storage
    .from(ARCHIVOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function resolveLogoUrl(
  admin: ReturnType<typeof createAdminClient>,
  logoUrl: string | null | undefined,
  requestOrigin?: string | null,
): Promise<string | null> {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  if (logoUrl.startsWith("/")) {
    return absolutizeAssetUrl(logoUrl, requestOrigin);
  }
  if (isStoredObject(logoUrl)) {
    return signedStorageUrl(admin, logoUrl);
  }
  return absolutizeAssetUrl(logoUrl, requestOrigin);
}

export async function mapArticuloToPublicDto(
  row: ArticuloRow,
  eventoSlug: string,
  requestOrigin?: string | null,
  adminClient?: ReturnType<typeof createAdminClient>,
): Promise<PublicArticuloDto> {
  const admin = adminClient ?? createAdminClient();

  const imagenFromPath = await signedStorageUrl(admin, row.imagen_path);
  const logo = await resolveLogoUrl(admin, row.logo_url, requestOrigin);

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    companyName: row.company_name ?? "Sponsor",
    logoUrl: logo,
    tier: row.tier,
    categoria: row.categoria_text ?? row.categoria,
    datoImpactante: row.dato_impactante,
    articuloTexto: row.articulo_texto ?? row.articulo_corto,
    imagenUrl: imagenFromPath ?? row.imagen_url,
    publishedAt: row.published_at,
    eventoSlug,
  };
}

export async function getEventoBySlugPublic(
  slug: string,
): Promise<EventoRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventoRow;
}

export async function listPublishedArticulos(
  eventoSlug: string,
  requestOrigin?: string | null,
): Promise<{ data: PublicArticuloDto[] | null; error: string | null }> {
  const evento = await getEventoBySlugPublic(eventoSlug);
  if (!evento) {
    return { data: null, error: "Evento no encontrado." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articulos")
    .select("*")
    .eq("evento_id", evento.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  const rows = (data ?? []) as ArticuloRow[];
  const mapped = await Promise.all(
    rows.map((row) =>
      mapArticuloToPublicDto(row, evento.slug, requestOrigin, admin),
    ),
  );
  return { data: mapped, error: null };
}

export async function getPublishedArticuloBySlug(
  slug: string,
  eventoSlug: string,
  requestOrigin?: string | null,
): Promise<{ data: PublicArticuloDto | null; error: string | null; notFound?: boolean }> {
  const evento = await getEventoBySlugPublic(eventoSlug);
  if (!evento) {
    return { data: null, error: "Evento no encontrado.", notFound: true };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("articulos")
    .select("*")
    .eq("evento_id", evento.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }
  if (!data) {
    return { data: null, error: "Artículo no encontrado.", notFound: true };
  }

  const dto = await mapArticuloToPublicDto(
    data as ArticuloRow,
    evento.slug,
    requestOrigin,
    admin,
  );
  return { data: dto, error: null };
}
