import { ARCHIVOS_BUCKET } from "@/lib/portal/beneficios";

export { ARCHIVOS_BUCKET };

export const ARTICULO_CATEGORIAS = [
  "IA & Automatización",
  "Fintech & Pagos",
  "Future of Work",
  "Movilidad & Logística",
  "SaaS & Software",
  "Talento & Educación",
  "Ventas & Marketing",
  "Startups & Venture",
  "Ciberseguridad",
  "E-commerce & Retail",
] as const;

export type ArticuloCategoria = (typeof ARTICULO_CATEGORIAS)[number];

export type ArticuloStatus = "draft" | "published";

export type ImageCrop = {
  x: number;
  y: number;
  zoom: number;
};

export type ArticuloRow = {
  id: string;
  evento_id: string;
  sponsor_id: string;
  dato_impactante: string;
  articulo_corto: string | null;
  categoria: string | null;
  status: ArticuloStatus;
  slug: string | null;
  published_at: string | null;
  image_source_path: string | null;
  imagen_path: string | null;
  image_crop: ImageCrop | null;
  company_name: string | null;
  logo_url: string | null;
  tier: string | null;
  categoria_text: string | null;
  articulo_texto: string | null;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Prefill from portal LinkedIn/Instagram insumos when no article saved yet. */
export type ArticuloInsumoPrefill = {
  dato_impactante: string;
  articulo_corto: string;
  image_url: string | null;
  image_path: string | null;
  from_insumo: true;
};

export type ArticuloSponsorCard = {
  id: string;
  nombre: string;
  paquete: string | null;
  logo_url: string | null;
  logo_preview_url: string | null;
  /** Static / storage URL for white logo variant (preview toggle). */
  logo_blanco_url: string | null;
  /** Static / storage URL for color logo variant (preview toggle). */
  logo_color_url: string | null;
  has_logo_blanco: boolean;
  articulo: ArticuloRow | null;
  image_source_url: string | null;
  imagen_preview_url: string | null;
  insumo_prefill: ArticuloInsumoPrefill | null;
};

export const PREVIEW_WIDTH = 540;
export const PREVIEW_HEIGHT = 675;
export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1350;
export const DATO_MAX_CHARS = 200;
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

/** Preferred logo paths for an event; UI falls back to `_default` on img error. */
export function eventLogoPaths(eventoSlug: string): {
  blanco: string;
  contraste: string;
} {
  const base = `/eventos/${eventoSlug}`;
  // Prefer PNG (official brand kits) over placeholder SVGs.
  return {
    blanco: `${base}/logo-blanco.png`,
    contraste: `${base}/logo-contraste.png`,
  };
}

export function eventLogoFallback(variant: "blanco" | "contraste"): string {
  return variant === "blanco"
    ? "/eventos/_default/logo-blanco.svg"
    : "/eventos/_default/logo-contraste.svg";
}

/** Join LinkedIn/IG paragraphs into onepager plain text. */
export function articuloCortoFromParrafos(
  p1: string,
  p2: string,
  p3: string,
): string {
  return [p1, p2, p3]
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function articuloStoragePath(
  sponsorId: string,
  kind: "source" | "final",
  ext = "jpg",
): string {
  const stamp = Date.now();
  const suffix = kind === "source" ? "source" : "1080x1350";
  return `${sponsorId}/articulos/${stamp}_${suffix}.${ext}`;
}

export function cardStatus(
  articulo: ArticuloRow | null,
): "sin" | "draft" | "published" {
  if (!articulo) return "sin";
  return articulo.status === "published" ? "published" : "draft";
}
