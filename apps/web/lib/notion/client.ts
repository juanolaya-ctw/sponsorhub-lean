import { Client } from "@notionhq/client";

export const GOVTECH_EVENT_SLUG = "govtech-2026";

export const GOVTECH_STATUS_PROPERTY = "Estado";

export const GOVTECH_SPONSOR_NAME_FIELDS = [
  "Sponsor*",
  "Sponsor",
  "Nombre",
] as const;

export const GOVTECH_STATUS_VALUES = [
  "Activo",
  "Pendiente por Kick off",
] as const;

const NOTION_VERSION_DATA_SOURCES = "2025-09-03";

export function getNotionClient(notionVersion?: string) {
  const auth = process.env.NOTION_API_KEY;
  if (!auth) {
    throw new Error("NOTION_API_KEY no está configurada.");
  }
  return new Client({
    auth,
    ...(notionVersion ? { notionVersion } : {}),
  });
}

export function getNotion2025Client() {
  return getNotionClient(NOTION_VERSION_DATA_SOURCES);
}

function formatUuid32(hex: string): string {
  const stripped = hex.replace(/-/g, "").toLowerCase();
  return [
    stripped.slice(0, 8),
    stripped.slice(8, 12),
    stripped.slice(12, 16),
    stripped.slice(16, 20),
    stripped.slice(20, 32),
  ].join("-");
}

/**
 * Extrae un UUID Notion de .env, SQL, collection:// o URL.
 * Las comillas del mensaje de error de Notion NO significan que el .env las tenga.
 */
export function normalizeNotionId(value: string): string {
  const cleaned = value
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["'`]+|["'`]+$/g, "");

  const dashed = cleaned.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (dashed) return formatUuid32(dashed[0]);

  const compact = cleaned.replace(/-/g, "").match(/[0-9a-f]{32}/i);
  if (compact) return formatUuid32(compact[0]);

  const preview = cleaned.replace(/\s+/g, " ").slice(0, 48);
  const kind = cleaned.startsWith("ntn_")
    ? "Eso parece NOTION_API_KEY (ntn_…), no el ID de la tabla."
    : `length=${cleaned.length}.`;
  throw new Error(
    `No encontré un data_source_id (32 hex) en notion_source_id. ${kind} Empieza: ${preview}`,
  );
}

export function tryNormalizeNotionId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return normalizeNotionId(value);
  } catch {
    return null;
  }
}
