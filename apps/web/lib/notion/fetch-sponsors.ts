import { getProperty, unwrapNotionProperty } from "@/lib/notion/unwrap";
import {
  getNotion2025Client,
  GOVTECH_SPONSOR_NAME_FIELDS,
  GOVTECH_STATUS_PROPERTY,
  GOVTECH_STATUS_VALUES,
  normalizeNotionId,
} from "./client";

export type NotionSponsorPage = {
  id: string;
  properties: Record<string, unknown>;
};

type DatabaseProperty = {
  type?: string;
  select?: { options?: Array<{ name?: string }> };
  status?: { options?: Array<{ name?: string }> };
};

type DataSourceObject = {
  object?: string;
  id?: string;
  properties?: Record<string, DatabaseProperty>;
  data_sources?: Array<{ id: string; name?: string }>;
};

type QueryResult = {
  results: Array<{ id: string; properties?: Record<string, unknown> }>;
  has_more: boolean;
  next_cursor: string | null;
};

function assertSponsorsDatabase(
  properties: Record<string, DatabaseProperty>,
): void {
  const keys = Object.keys(properties);
  const hasSponsorName = GOVTECH_SPONSOR_NAME_FIELDS.some((name) => name in properties);
  if (hasSponsorName) return;

  const looksLikeBeneficios =
    "Beneficio" in properties || "Categoria beneficio" in properties;

  throw new Error(
    looksLikeBeneficios
      ? "Esta Notion no es el CRM de sponsors: es un tablero de beneficios/acciones (tiene Beneficio, Estado, Landing CTW…). Cada fila no es un sponsor con paquete. Conecta SponsorHub Sync a la database donde cada fila es una empresa (columnas tipo Sponsor / Paquete / Status CS*) y pon ese data_source_id en NOTION_GOVTECH_DATA_SOURCE_ID."
      : `No hay columna de nombre de sponsor (${GOVTECH_SPONSOR_NAME_FIELDS.join(", ")}). Columns: ${keys.join(", ")}`,
  );
}

function notionErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : "Error desconocido de Notion.";
}

async function queryDataSource(
  dataSourceId: string,
): Promise<NotionSponsorPage[]> {
  const notion = getNotion2025Client();
  const pages: NotionSponsorPage[] = [];
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

type PageObject = {
  object?: string;
  id?: string;
  parent?: {
    type?: string;
    data_source_id?: string;
    database_id?: string;
    page_id?: string;
  };
  properties?: Record<string, DatabaseProperty>;
};

type SearchHit = {
  object?: string;
  id?: string;
  title?: Array<{ plain_text?: string }>;
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
};

type SearchResult = { results?: SearchHit[] };

function titleFromSearch(hit: SearchHit): string {
  const fromTitle = hit.title?.map((t) => t.plain_text ?? "").join("").trim();
  if (fromTitle) return fromTitle;
  const props = hit.properties ?? {};
  for (const prop of Object.values(props)) {
    if (prop.type === "title") {
      const text = prop.title?.map((t) => t.plain_text ?? "").join("").trim();
      if (text) return text;
    }
  }
  return "(sin título)";
}

async function listWhatIntegrationSees(): Promise<string> {
  const notion = getNotion2025Client();
  try {
    const search = await notion.request<SearchResult>({
      method: "post",
      path: "search",
      body: { page_size: 20 },
    });
    const hits = search.results ?? [];
    if (hits.length === 0) {
      return 'Sponsors Sync no ve ninguna página. En la database de sponsors: ••• → Connections → Add connection → "Sponsors Sync" (el nombre exacto del token, no otra integración).';
    }
    return `Sponsors Sync hoy ve: ${hits
      .map((hit) => `${hit.object ?? "?"} ${hit.id ?? "?"} ${titleFromSearch(hit)}`)
      .join(" | ")}`;
  } catch {
    return "";
  }
}

function notFoundError(id: string, attempts: string[], seen: string): Error {
  return new Error(
    [
      `Notion no encuentra ${id} para la integración "Sponsors Sync".`,
      "Abre ESA database (la URL debe contener ese UUID) → ••• → Connections → conecta exactamente \"Sponsors Sync\".",
      "Si conectaste otra tabla, copia el data_source_id de la CRM de sponsors (32 hex) a NOTION_GOVTECH_DATA_SOURCE_ID.",
      `Intentos: ${attempts.join("; ")}.`,
      seen,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function loadDataSource(
  notion: ReturnType<typeof getNotion2025Client>,
  dataSourceId: string,
): Promise<{ id: string; properties: Record<string, DatabaseProperty> }> {
  const source = await notion.request<DataSourceObject>({
    method: "get",
    path: `data_sources/${dataSourceId}`,
  });
  if (!source.properties) {
    throw new Error(`El data source ${dataSourceId} no devolvió properties.`);
  }
  return { id: source.id ?? dataSourceId, properties: source.properties };
}

/**
 * Resuelve un UUID de Notion (data_source, database o page) al data_source
 * queryable. Reutilizado por fetch de sponsors y LAB Beneficios.
 */
export async function resolveDataSource(
  rawId: string,
): Promise<{ id: string; properties: Record<string, DatabaseProperty> }> {
  const notion = getNotion2025Client();
  const attempts: string[] = [];

  try {
    return await loadDataSource(notion, rawId);
  } catch (err) {
    attempts.push(`data_source: ${notionErrorMessage(err)}`);
  }

  try {
    const database = await notion.request<DataSourceObject>({
      method: "get",
      path: `databases/${rawId}`,
    });
    const childId = database.data_sources?.[0]?.id;
    if (childId) return await loadDataSource(notion, childId);
    attempts.push("database: sin data_sources");
  } catch (err) {
    attempts.push(`database: ${notionErrorMessage(err)}`);
  }

  try {
    const page = await notion.request<PageObject>({
      method: "get",
      path: `pages/${rawId}`,
    });
    const parentId =
      page.parent?.data_source_id ?? page.parent?.database_id ?? null;
    if (parentId) {
      try {
        return await loadDataSource(notion, normalizeNotionId(parentId));
      } catch {
        const database = await notion.request<DataSourceObject>({
          method: "get",
          path: `databases/${parentId}`,
        });
        const childId = database.data_sources?.[0]?.id;
        if (childId) return await loadDataSource(notion, childId);
      }
    }
    attempts.push(
      `page: parent=${page.parent?.type ?? "?"} ${parentId ?? "ninguno"}`,
    );
  } catch (err) {
    attempts.push(`page: ${notionErrorMessage(err)}`);
  }

  const seen = await listWhatIntegrationSees();
  throw notFoundError(rawId, attempts, seen);
}

export type FetchSponsorsResult = {
  pages: NotionSponsorPage[];
  totalInNotion: number;
  estadosVistos: string[];
  aviso: string | null;
  muestraPropiedades: Array<{ nombre: string; tipo: string; valor: string | null }>;
};

function normalizeLabel(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function estadoOf(page: NotionSponsorPage): string {
  return normalizeLabel(
    unwrapNotionProperty(getProperty(page.properties, GOVTECH_STATUS_PROPERTY)),
  );
}

function matchesEstado(page: NotionSponsorPage): boolean {
  const estado = estadoOf(page);
  return (GOVTECH_STATUS_VALUES as readonly string[]).some(
    (wanted) => normalizeLabel(wanted) === estado,
  );
}

function sampleProperties(page: NotionSponsorPage | undefined) {
  if (!page) return [];
  return Object.entries(page.properties).map(([nombre, property]) => ({
    nombre,
    tipo:
      property && typeof property === "object" && "type" in property
        ? String((property as { type?: string }).type ?? "?")
        : "?",
    valor: unwrapNotionProperty(property),
  }));
}

export async function fetchSponsorsFromNotion(
  dataSourceId: string,
): Promise<FetchSponsorsResult> {
  const id = normalizeNotionId(dataSourceId);
  const source = await resolveDataSource(id);
  assertSponsorsDatabase(source.properties);

  const hasEstado = Object.keys(source.properties).some(
    (key) => key.trim().toLowerCase() === GOVTECH_STATUS_PROPERTY.toLowerCase(),
  );
  if (!hasEstado) {
    const keys = Object.keys(source.properties).join(", ");
    throw new Error(
      `No hay columna "${GOVTECH_STATUS_PROPERTY}". Columns: ${keys}`,
    );
  }

  const allPages = await queryDataSource(source.id);
  const estadosVistos = [
    ...new Set(allPages.map((page) => estadoOf(page) || "(vacío)")),
  ].sort();

  const matched = allPages.filter((page) => matchesEstado(page));
  const allEmpty = estadosVistos.length === 1 && estadosVistos[0] === "(vacío)";
  const pages = allEmpty ? allPages : matched;

  return {
    pages,
    totalInNotion: allPages.length,
    estadosVistos,
    aviso: allEmpty
      ? `Estado está vacío en las ${allPages.length} filas; se sincronizan todas. Rellena Activo / Pendiente por Kick off en Notion para filtrar después.`
      : null,
    muestraPropiedades: sampleProperties(allPages[0]),
  };
}
