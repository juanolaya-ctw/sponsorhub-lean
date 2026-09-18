import {
  getProperty,
  unwrapNotionProperty,
  unwrapRelationIds,
} from "@/lib/notion/unwrap";
import {
  getNotion2025Client,
  normalizeNotionId,
  tryNormalizeNotionId,
} from "./client";
import { resolveDataSource } from "./fetch-sponsors";

export const LAB_BENEFICIO_TITLE = "Beneficio";
export const LAB_TIPO_BENEFICIO = "Tipo de Beneficio";
export const LAB_CATEGORIA_BENEFICIO = "Categoria beneficio";
export const LAB_SPONSOR_CRM = "Sponsor (CRM)";

export const TIPOS_BENEFICIO = [
  "Contrato",
  "Upgrade",
  "Tailor made",
  "Adicional",
] as const;

export const CATEGORIAS_BENEFICIO = [
  "Pre evento",
  "Durante evento",
  "Post evento",
] as const;

export type TipoBeneficio = (typeof TIPOS_BENEFICIO)[number];
export type CategoriaBeneficio = (typeof CATEGORIAS_BENEFICIO)[number];

export type LabBeneficioRow = {
  /** Page ID de la fila en LAB Beneficios (clave de upsert). */
  notion_page_id: string;
  /** Título → compromisos.tipo */
  nombre: string;
  tipo_beneficio: TipoBeneficio | null;
  categoria_beneficio: CategoriaBeneficio | null;
  /** Page IDs del CRM de sponsors (relation). */
  sponsor_crm_page_ids: string[];
};

type QueryResult = {
  results: Array<{ id: string; properties?: Record<string, unknown> }>;
  has_more: boolean;
  next_cursor: string | null;
};

function assertLabBeneficiosDatabase(
  properties: Record<string, { type?: string }>,
): void {
  const keys = Object.keys(properties);
  const has = (name: string) =>
    keys.some((key) => key.trim().toLowerCase() === name.toLowerCase());

  const missing: string[] = [];
  if (!has(LAB_BENEFICIO_TITLE)) missing.push(LAB_BENEFICIO_TITLE);
  if (!has(LAB_TIPO_BENEFICIO)) missing.push(LAB_TIPO_BENEFICIO);
  if (!has(LAB_CATEGORIA_BENEFICIO)) missing.push(LAB_CATEGORIA_BENEFICIO);
  if (!has(LAB_SPONSOR_CRM)) missing.push(LAB_SPONSOR_CRM);

  if (missing.length > 0) {
    throw new Error(
      `Esta Notion no parece LAB Beneficios (faltan: ${missing.join(", ")}). Columns: ${keys.join(", ")}. Conecta NOTION_LAB_BENEFICIOS_ID a la database con Beneficio / Tipo de Beneficio / Categoria beneficio / Sponsor (CRM).`,
    );
  }
}

async function queryDataSource(
  dataSourceId: string,
): Promise<Array<{ id: string; properties: Record<string, unknown> }>> {
  const notion = getNotion2025Client();
  const pages: Array<{ id: string; properties: Record<string, unknown> }> = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.request<QueryResult>({
      method: "post",
      path: `data_sources/${dataSourceId}/query`,
      body: {
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      },
    });

    for (const page of response.results) {
      if (!page.properties) continue;
      pages.push({ id: page.id, properties: page.properties });
    }

    startCursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (startCursor);

  return pages;
}

function isTipoBeneficio(value: string | null): value is TipoBeneficio {
  return (
    value !== null &&
    (TIPOS_BENEFICIO as readonly string[]).includes(value)
  );
}

function isCategoriaBeneficio(
  value: string | null,
): value is CategoriaBeneficio {
  return (
    value !== null &&
    (CATEGORIAS_BENEFICIO as readonly string[]).includes(value)
  );
}

/** Mapea una página LAB Beneficios (cron o webhook de una sola fila). */
export function mapLabBeneficioPage(
  page: { id: string; properties: Record<string, unknown> },
): LabBeneficioRow | { skip: string } {
  const nombre = unwrapNotionProperty(
    getProperty(page.properties, LAB_BENEFICIO_TITLE),
  )?.trim();
  if (!nombre) {
    return { skip: `LAB ${page.id}: sin título Beneficio.` };
  }

  const tipoRaw = unwrapNotionProperty(
    getProperty(page.properties, LAB_TIPO_BENEFICIO),
  );
  const categoriaRaw = unwrapNotionProperty(
    getProperty(page.properties, LAB_CATEGORIA_BENEFICIO),
  );
  const relationIds = unwrapRelationIds(
    getProperty(page.properties, LAB_SPONSOR_CRM),
  );

  if (relationIds.length === 0) {
    return { skip: `LAB "${nombre}" (${page.id}): Sponsor (CRM) vacío.` };
  }

  const tipo_beneficio = isTipoBeneficio(tipoRaw) ? tipoRaw : null;
  if (tipoRaw && !tipo_beneficio) {
    return {
      skip: `LAB "${nombre}" (${page.id}): tipo_beneficio inválido "${tipoRaw}".`,
    };
  }

  const categoria_beneficio = isCategoriaBeneficio(categoriaRaw)
    ? categoriaRaw
    : null;
  if (categoriaRaw && !categoria_beneficio) {
    return {
      skip: `LAB "${nombre}" (${page.id}): categoria_beneficio inválida "${categoriaRaw}".`,
    };
  }

  const sponsor_crm_page_ids = relationIds
    .map((id) => tryNormalizeNotionId(id) ?? id)
    .filter(Boolean);

  return {
    notion_page_id: page.id,
    nombre,
    tipo_beneficio,
    categoria_beneficio,
    sponsor_crm_page_ids,
  };
}

export type FetchLabBeneficiosResult = {
  rows: LabBeneficioRow[];
  totalInNotion: number;
  skipped: string[];
};

/**
 * Fetch paginado de LAB Beneficios.
 * Ignora filas sin Sponsor (CRM) o sin título.
 */
export async function fetchLabBeneficiosFromNotion(
  rawId: string,
): Promise<FetchLabBeneficiosResult> {
  const id = normalizeNotionId(rawId);
  const source = await resolveDataSource(id);
  assertLabBeneficiosDatabase(source.properties);

  const pages = await queryDataSource(source.id);
  const rows: LabBeneficioRow[] = [];
  const skipped: string[] = [];

  for (const page of pages) {
    const mapped = mapLabBeneficioPage(page);
    if ("skip" in mapped) {
      skipped.push(mapped.skip);
      continue;
    }
    rows.push(mapped);
  }

  return {
    rows,
    totalInNotion: pages.length,
    skipped,
  };
}
