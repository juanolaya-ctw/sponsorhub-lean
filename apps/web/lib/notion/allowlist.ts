/**
 * Allowlist explícito de campos de Notion que pueden entrar al sync.
 *
 * REGLA: esto es un allowlist, no un blocklist. Si un campo no está
 * listado aquí, NO se sincroniza — sin importar qué tan inofensivo
 * parezca. Cuando CS agregue una columna nueva en Notion, esa columna
 * NO llega a la app hasta que alguien la agregue aquí explícitamente.
 *
 * Por qué esto existe: el "Customer Success Board" de Notion mezcla
 * datos de venta ($$*, *Ya Pago 50%?), asignación interna (Owner, Key,
 * Bloqueado por) y datos operativos del sponsor en la misma tabla.
 * Un sync ingenuo ("traer todo lo del sponsor") expondría datos
 * comerciales internos al dashboard del sponsor. Ver docs/NOTION_MAPPING.md.
 */

export const SPONSOR_FIELD_ALLOWLIST = {
  "Sponsor*": "nombre",
  "*Paquete": "paquete",
  "*Contacto": "contacto_nombre",
  "*Mail Principal": "contacto_email",
  "*Teléfono": "contacto_telefono",
  "Cargo": "contacto_cargo",
  "Link Logo": "logo_url",
} as const;

/**
 * Allowlist del sync GovTech. Nombres CS Board primero; alias comunes
 * por si la DB GovTech usa labels distintos. El primero que tenga valor gana.
 * No incluye speaker ni entregables: esas columnas no existen en `sponsors`.
 */
export const GOVTECH_SPONSOR_FIELD_ALLOWLIST = [
  ["Sponsor*", "nombre"],
  ["Sponsor", "nombre"],
  ["Nombre", "nombre"],
  ["Nombre de la empresa", "nombre"],
  ["Empresa", "nombre"],
  ["Company", "nombre"],
  ["Cliente", "nombre"],
  ["*Paquete", "paquete"],
  ["Paquete", "paquete"],
  ["Tier", "paquete"],
  ["*Contacto", "contacto_nombre"],
  ["Contacto", "contacto_nombre"],
  ["*Mail Principal", "contacto_email"],
  ["Mail Principal", "contacto_email"],
  ["Email", "contacto_email"],
  ["*Teléfono", "contacto_telefono"],
  ["Teléfono", "contacto_telefono"],
  ["Telefono", "contacto_telefono"],
  ["Cargo", "contacto_cargo"],
  ["Link Logo", "logo_url"],
  ["Logo", "logo_url"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export const COMPROMISO_SOURCE_FIELDS = [
  "Actividad",      // multi-select de 13 valores -> se traduce a filas de `compromisos`
  "Estadoweb",       // multi-select -> se traduce a filas de `compromisos`
  "% BBDD",          // select "50"/"100" -> parseado a integer
  "Entrega bbdd",    // checkbox -> compromiso tipo 'entrega_bbdd'
  "Logo web",        // checkbox -> compromiso tipo 'logo_web'
  "Logo piezas CTW", // checkbox -> compromiso tipo 'logo_piezas'
  "Newsletter ",     // checkbox -> compromiso tipo 'newsletter'
  "Anuncio patrocinio", // checkbox -> compromiso tipo 'anuncio_patrocinio'
] as const;

export const SPEAKER_FIELD_ALLOWLIST = {
  "Vocero Confirmado": "speaker_nombre",
  "Perfil del vocero": "speaker_perfil",
  "Linkedin Vocero ": "speaker_linkedin",
  "Foto del vocero": "speaker_foto_url",
} as const;

export const ENTREGABLE_FIELD_ALLOWLIST = {
  "Enlace publicación Newsletter": "newsletter_url",
  "Informe Final": "informe_final_url",
  "PPT informe final": "informe_final_ppt_url",
} as const;

/**
 * Campos EXPLÍCITAMENTE excluidos — documentados aquí para que quede
 * registro de que la exclusión fue una decisión, no un olvido.
 * Nunca agregar estos al allowlist sin decisión explícita del equipo.
 */
export const NEVER_SYNC = [
  "$$*",
  "*Ya Pago 50%?",
  "*Ya pago 100%?",
  "Owner",
  "Key ",
  "Grupo",
  "Bloqueado por",
  "Está bloqueando",
  "Tasks Customer Success",
  "🗂️ CRM Sales",
  "Encargado SALES",
  "Mail SALES",
  "Cel SALES",
  "Paquete SALES",
  "Estado Sales",
  "*Contrato", // referencia legal — visible solo para CS, no para el sponsor
] as const;

export type SponsorFieldKey = keyof typeof SPONSOR_FIELD_ALLOWLIST;

/**
 * Filtra un objeto crudo de properties de Notion (sponsor), dejando SOLO
 * los campos listados en SPONSOR_FIELD_ALLOWLIST. Cualquier campo fuera
 * de la lista se descarta silenciosamente — ese es el comportamiento
 * correcto para columnas nuevas que CS agregue en Notion sin avisar:
 * no entran hasta que alguien las agregue aquí explícitamente.
 */
export function filterSponsorFields(
  rawProperties: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [notionField, pgColumn] of Object.entries(SPONSOR_FIELD_ALLOWLIST)) {
    if (notionField in rawProperties) {
      result[pgColumn] = rawProperties[notionField];
    }
  }
  return result;
}

export function filterSpeakerFields(
  rawProperties: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [notionField, pgColumn] of Object.entries(SPEAKER_FIELD_ALLOWLIST)) {
    if (notionField in rawProperties) {
      result[pgColumn] = rawProperties[notionField];
    }
  }
  return result;
}

export function filterEntregableFields(
  rawProperties: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [notionField, pgColumn] of Object.entries(ENTREGABLE_FIELD_ALLOWLIST)) {
    if (notionField in rawProperties) {
      result[pgColumn] = rawProperties[notionField];
    }
  }
  return result;
}
