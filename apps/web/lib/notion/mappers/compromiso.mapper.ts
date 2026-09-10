/**
 * Traduce el estado de compromisos desde el modelo ambiguo de Notion
 * (multi-selects "Actividad" y "Estadoweb", más varios checkboxes)
 * a filas normalizadas de la tabla `compromisos`.
 *
 * Esto es lógica de negocio, no CRUD — por eso vive en Claude Code,
 * no en Codex. Ver docs/NOTION_MAPPING.md para la tabla de traducción
 * completa que el equipo de CS validó.
 */

export type CompromisoEstado = "pendiente" | "en_progreso" | "completado";

export interface CompromisoRow {
  sponsor_id: string;
  tipo: string;
  estado: CompromisoEstado;
  porcentaje: number;
  notion_source_field: string;
}

interface NotionSponsorRecord {
  notionPageId: string;
  actividad: string[]; // valores del multi-select "Actividad"
  estadoweb: string[]; // valores del multi-select "Estadoweb"
  porcentajeBBDD: "50" | "100" | null;
  entregaBbdd: boolean;
  logoWeb: boolean;
  logoPiezasCTW: boolean;
  newsletter: boolean;
  anuncioPatrocinio: boolean;
}

// Mapeo explícito: valor de Notion -> estado normalizado.
// Cualquier valor de Actividad/Estadoweb no listado aquí debe fallar
// ruidosamente en el sync (no asumir un default silencioso), para que
// un valor nuevo agregado por CS en Notion no se pierda sin aviso.
const ACTIVIDAD_A_ESTADO: Record<string, CompromisoEstado> = {
  "Pendiente recepción logo": "pendiente",
  "Por solicitar a diseño": "pendiente",
  "En diseño": "en_progreso",
  "Notificado": "en_progreso",
  "Publicado": "completado",
};

export function mapCompromisosFromNotion(
  record: NotionSponsorRecord,
  sponsorId: string
): CompromisoRow[] {
  const rows: CompromisoRow[] = [];

  // % de avance de base de datos: es el único campo que ya viene como
  // progreso explícito, no hay que inferirlo de un multi-select.
  if (record.porcentajeBBDD) {
    rows.push({
      sponsor_id: sponsorId,
      tipo: "base_de_datos",
      estado: record.porcentajeBBDD === "100" ? "completado" : "en_progreso",
      porcentaje: parseInt(record.porcentajeBBDD, 10),
      notion_source_field: "% BBDD",
    });
  }

  // Checkboxes simples: booleano -> completado/pendiente, 0 o 100.
  const checkboxCompromisos: Array<[boolean, string, string]> = [
    [record.entregaBbdd, "entrega_bbdd", "Entrega bbdd"],
    [record.logoWeb, "logo_web", "Logo web"],
    [record.logoPiezasCTW, "logo_piezas_ctw", "Logo piezas CTW"],
    [record.newsletter, "newsletter", "Newsletter "],
    [record.anuncioPatrocinio, "anuncio_patrocinio", "Anuncio patrocinio"],
  ];

  for (const [checked, tipo, sourceField] of checkboxCompromisos) {
    rows.push({
      sponsor_id: sponsorId,
      tipo,
      estado: checked ? "completado" : "pendiente",
      porcentaje: checked ? 100 : 0,
      notion_source_field: sourceField,
    });
  }

  // Multi-select "Actividad": cada valor presente es un compromiso propio.
  for (const valor of record.actividad) {
    const estado = ACTIVIDAD_A_ESTADO[valor];
    if (!estado) {
      // No silenciar: un valor nuevo en Notion que no está mapeado
      // debe ser visible en logs de sync, no perderse.
      console.warn(`[sync] Valor de Actividad sin mapeo: "${valor}"`);
      continue;
    }
    rows.push({
      sponsor_id: sponsorId,
      tipo: `actividad_${valor.toLowerCase().replace(/\s+/g, "_")}`,
      estado,
      porcentaje: estado === "completado" ? 100 : estado === "en_progreso" ? 50 : 0,
      notion_source_field: "Actividad",
    });
  }

  return rows;
}
