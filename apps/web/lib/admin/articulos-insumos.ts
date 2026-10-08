import {
  isStoredObject,
  parseLinkedInInstagram,
  TIPO_LINKEDIN_INSTAGRAM,
  type LinkedInInstagramPayload,
} from "@/lib/portal/beneficios";
import {
  articuloCortoFromParrafos,
  type ArticuloInsumoPrefill,
} from "@/lib/admin/articulos";

export type ArchivoInsumoRow = {
  sponsor_id: string;
  storage_path: string;
  tipo: string;
  nombre_archivo: string;
  created_at: string;
};

/** Tipos / nombres de beneficio que corresponden a contenido RRSS. */
export function isLinkedInInsumoTipo(tipo: string): boolean {
  if (tipo === TIPO_LINKEDIN_INSTAGRAM) return true;
  if (tipo === "info_redes") return true;
  return /linkedin|instagram|redes|contenido/i.test(tipo);
}

export function extractLinkedInPayload(
  row: ArchivoInsumoRow,
): LinkedInInstagramPayload | null {
  const fromJson = parseLinkedInInstagram(row.nombre_archivo);
  if (fromJson) return fromJson;

  // Legado info_redes (texto+link): nombre_archivo = copy plano.
  if (tipoEsTextoPlanoRedes(row) && row.nombre_archivo.trim()) {
    const text = row.nombre_archivo.trim();
    return {
      dato_impactante: text.slice(0, 200),
      parrafo1: text,
      parrafo2: "",
      parrafo3: "",
    };
  }
  return null;
}

function tipoEsTextoPlanoRedes(row: ArchivoInsumoRow): boolean {
  if (!isLinkedInInsumoTipo(row.tipo)) return false;
  if (parseLinkedInInstagram(row.nombre_archivo)) return false;
  // Centinela de texto o URL en storage_path (flujo texto+link).
  return (
    !isStoredObject(row.storage_path) ||
    /^https?:/i.test(row.storage_path) ||
    row.storage_path === "texto"
  );
}

export function buildInsumoPrefillFromArchivos(
  rows: ArchivoInsumoRow[],
  imageUrlByPath: Map<string, string | null>,
): ArticuloInsumoPrefill | null {
  const liRows = rows.filter((r) => isLinkedInInsumoTipo(r.tipo));
  if (liRows.length === 0) {
    // Fallback: cualquier fila cuyo nombre_archivo sea JSON de LI.
    const withPayload = rows.filter((r) =>
      Boolean(parseLinkedInInstagram(r.nombre_archivo)),
    );
    if (withPayload.length === 0) return null;
    return buildFromLiRows(withPayload, imageUrlByPath);
  }
  return buildFromLiRows(liRows, imageUrlByPath);
}

function buildFromLiRows(
  liRows: ArchivoInsumoRow[],
  imageUrlByPath: Map<string, string | null>,
): ArticuloInsumoPrefill | null {
  const payloadRow =
    liRows.find((r) => Boolean(extractLinkedInPayload(r))) ?? null;
  const payload = payloadRow ? extractLinkedInPayload(payloadRow) : null;

  // Imágenes reales en Storage (mismo criterio que el portal).
  const images = liRows
    .filter((r) => isStoredObject(r.storage_path))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  if (!payload && images.length === 0) return null;

  const firstImage = images[0] ?? null;
  const imagePath = firstImage?.storage_path ?? null;

  return {
    dato_impactante: payload?.dato_impactante?.trim() ?? "",
    articulo_corto: articuloCortoFromParrafos(
      payload?.parrafo1 ?? "",
      payload?.parrafo2 ?? "",
      payload?.parrafo3 ?? "",
    ),
    image_url: imagePath ? (imageUrlByPath.get(imagePath) ?? null) : null,
    image_path: imagePath,
    from_insumo: true,
  };
}

export function isLikelyHttpImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  // Notion / CDN links often omit extension; still try them if https.
  return true;
}
