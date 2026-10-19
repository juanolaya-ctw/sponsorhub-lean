/**
 * Mapea el Estado del LAB Beneficios (Notion) → nombre en estados_compromiso (Hub).
 * Notion es fuente de verdad de la entrega CS.
 */
export const LAB_ESTADO_PROPERTY_CANDIDATES = [
  "Estado",
  "Estado beneficio",
  "Status",
] as const

export function mapEstadoNotionToHubNombre(
  estadoNotion: string | null | undefined,
): string {
  if (!estadoNotion?.trim()) return "Pendiente"
  const value = estadoNotion.trim().toLowerCase()

  if (
    value === "listo" ||
    value === "completado" ||
    value === "done" ||
    value === "entregado"
  ) {
    return "Completado"
  }
  if (
    value === "en curso" ||
    value === "en progreso" ||
    value === "in progress" ||
    value === "en_progreso"
  ) {
    return "En progreso"
  }
  if (value === "vencido" || value === "overdue") {
    return "Vencido"
  }
  if (value === "publicado" || value === "published") {
    return "Publicado"
  }
  if (value === "pendiente" || value === "todo" || value === "not started") {
    return "Pendiente"
  }

  // Fallback: intentar match exacto por capitalización común
  if (estadoNotion === "En progreso") return "En progreso"
  if (estadoNotion === "Completado") return "Completado"
  return "Pendiente"
}
