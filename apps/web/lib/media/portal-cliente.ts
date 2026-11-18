/**
 * Helpers puros para el portal Media del cliente (media_contacto) y para
 * las instrucciones de insumos que CT define por pieza desde admin.
 * Sin dependencias de servidor: se pueden usar en client components y tests.
 */

export type AssetEstadoCliente =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado"

export const ESTADO_CLIENTE: Record<
  AssetEstadoCliente,
  { label: string; quienActua: string; esTurnoCliente: boolean }
> = {
  pendiente_insumos: {
    label: "Pendiente de insumos",
    quienActua: "Te toca: sube los archivos que pide esta pieza.",
    esTurnoCliente: true,
  },
  insumos_recibidos: {
    label: "Insumos recibidos",
    quienActua: "CT revisa tus archivos y empieza la producción.",
    esTurnoCliente: false,
  },
  en_ejecucion: {
    label: "En producción",
    quienActua: "CT está produciendo esta pieza.",
    esTurnoCliente: false,
  },
  entregado: {
    label: "Entregada",
    quienActua: "CT ya entregó esta pieza.",
    esTurnoCliente: false,
  },
  aprobado: {
    label: "Aprobada",
    quienActua: "Pieza finalizada. No necesitas hacer nada.",
    esTurnoCliente: false,
  },
}

export function estadoCliente(estado: string | null | undefined) {
  return (
    ESTADO_CLIENTE[(estado ?? "pendiente_insumos") as AssetEstadoCliente] ??
    ESTADO_CLIENTE.pendiente_insumos
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseIsoDate(value: string): Date | null {
  const v = value.slice(0, 10)
  if (!ISO_DATE.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // Rechaza fechas como 2026-02-31 que JS normaliza
  if (d.toISOString().slice(0, 10) !== v) return null
  return d
}

/** "18 nov 2026" (fecha calendario, sin corrimiento de zona horaria). */
export function formatFechaCorta(value: string | null | undefined): string | null {
  if (!value) return null
  const d = parseIsoDate(value)
  if (!d) return null
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "noviembre de 2026" a partir de periodo YYYY-MM-01. */
export function formatMes(periodo: string): string {
  const d = parseIsoDate(periodo)
  if (!d) return periodo
  return d.toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Periodo del ciclo para mostrar al cliente: rango de fechas del acuerdo si
 * existe; si no, el mes del ciclo.
 */
export function formatPeriodoCiclo(input: {
  periodo: string
  fechaInicio?: string | null
  fechaFin?: string | null
}): { label: string; esRango: boolean } {
  const ini = formatFechaCorta(input.fechaInicio)
  const fin = formatFechaCorta(input.fechaFin)
  if (ini && fin) return { label: `${ini} – ${fin}`, esRango: true }
  if (ini) return { label: `Desde ${ini}`, esRango: true }
  if (fin) return { label: `Hasta ${fin}`, esRango: true }
  return { label: formatMes(input.periodo), esRango: false }
}

/**
 * Estados en los que CT ya ejecutó la pieza: solo ahí los créditos cuentan
 * como "usados". Antes (pendiente_insumos, insumos_recibidos) están
 * "asignados" a la pieza pero no usados.
 */
export const ESTADOS_EJECUTADOS: readonly AssetEstadoCliente[] = [
  "en_ejecucion",
  "entregado",
  "aprobado",
]

export function piezaEjecutada(estado: string | null | undefined): boolean {
  return ESTADOS_EJECUTADOS.includes(estado as AssetEstadoCliente)
}

export type ResumenSaldo = {
  /** Créditos del plan en el ciclo: asignados + extra + rollover. */
  pool: number
  /** Créditos asignados a piezas planeadas (cualquier estado no cancelado). */
  asignadosPiezas: number
  /** Créditos usados: solo piezas ya ejecutadas por CT. */
  usados: number
  /** pool - asignadosPiezas (nunca negativo en UI). */
  disponibles: number
  /** % del pool asignado a piezas, 0..100. */
  porcentajeAsignado: number
  /** % del pool usado, 0..100. */
  porcentajeUsado: number
}

export function resumenSaldo(input: {
  asignados: number | null | undefined
  extra?: number | null
  rollover?: number | null
  piezas: { costoCreditos: number | null | undefined; estado: string | null | undefined }[]
}): ResumenSaldo {
  const pool =
    (Number(input.asignados) || 0) +
    (Number(input.extra) || 0) +
    (Number(input.rollover) || 0)
  let asignadosPiezas = 0
  let usados = 0
  for (const p of input.piezas) {
    if (p.estado === "cancelado") continue
    const c = Math.max(0, Number(p.costoCreditos) || 0)
    asignadosPiezas += c
    if (piezaEjecutada(p.estado)) usados += c
  }
  const pct = (v: number) =>
    pool > 0 ? Math.min(100, Math.round((v / pool) * 100)) : 0
  return {
    pool,
    asignadosPiezas,
    usados,
    disponibles: Math.max(0, pool - asignadosPiezas),
    porcentajeAsignado: pct(asignadosPiezas),
    porcentajeUsado: pct(usados),
  }
}

/**
 * Numera las piezas de un ciclo de forma estable (#1..#n) por fecha de
 * creación ascendente; desempata por id.
 */
export function numerarPiezas<T extends { id: string; createdAt: string | null }>(
  piezas: T[],
): (T & { numero: number })[] {
  return [...piezas]
    .sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY
      const tb = b.createdAt ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY
      if (ta !== tb) return ta - tb
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    .map((p, i) => ({ ...p, numero: i + 1 }))
}

export function formatUsdTarifa(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return null
  }
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

// ── Instrucciones de insumos (admin) ─────────────────────────────────────────

export const INSTRUCCIONES_MAX = 2000
export const FORMATO_MAX = 200

export type InstruccionesInsumosInput = {
  instrucciones?: string | null
  formato?: string | null
  fechaLimite?: string | null
  /** undefined = no tocar la fecha planeada. */
  fechaPlaneada?: string | null
}

/** Columnas en media_assets_ejecutados. */
export type InstruccionesInsumosPatch = {
  insumos_notas: string | null
  insumos_formato: string | null
  insumos_fecha_limite: string | null
  fecha_planeada?: string | null
}

function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const t = String(value).replace(/\r\n/g, "\n").trim()
  return t.length > 0 ? t : null
}

export function normalizeInstruccionesInsumos(
  input: InstruccionesInsumosInput,
): { ok: true; patch: InstruccionesInsumosPatch } | { ok: false; error: string } {
  const instrucciones = cleanText(input.instrucciones)
  const formato = cleanText(input.formato)
  const fecha = cleanText(input.fechaLimite)

  if (instrucciones && instrucciones.length > INSTRUCCIONES_MAX) {
    return {
      ok: false,
      error: `Las instrucciones no pueden superar ${INSTRUCCIONES_MAX} caracteres.`,
    }
  }
  if (formato && formato.length > FORMATO_MAX) {
    return {
      ok: false,
      error: `El formato no puede superar ${FORMATO_MAX} caracteres.`,
    }
  }
  if (fecha && !parseIsoDate(fecha)) {
    return { ok: false, error: "Fecha límite inválida (usa AAAA-MM-DD)." }
  }
  const planeada = cleanText(input.fechaPlaneada)
  if (planeada && !parseIsoDate(planeada)) {
    return { ok: false, error: "Fecha planeada inválida (usa AAAA-MM-DD)." }
  }

  const patch: InstruccionesInsumosPatch = {
    insumos_notas: instrucciones,
    insumos_formato: formato,
    insumos_fecha_limite: fecha ? fecha.slice(0, 10) : null,
  }
  if (input.fechaPlaneada !== undefined) {
    patch.fecha_planeada = planeada ? planeada.slice(0, 10) : null
  }
  return { ok: true, patch }
}

export function tieneInstrucciones(p: {
  instrucciones?: string | null
  formato?: string | null
  fechaLimite?: string | null
}): boolean {
  return Boolean(
    cleanText(p.instrucciones) || cleanText(p.formato) || cleanText(p.fechaLimite),
  )
}

// ── Checklist de insumos (un ítem por línea) ─────────────────────────────────

const BULLET = /^\s*(?:[-*•·]|\d+[.)]|\[\s?\])\s+/

/** Convierte texto multilínea en ítems; quita viñetas y líneas vacías. */
export function parseChecklist(text: string | null | undefined): string[] {
  if (!text) return []
  return String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(BULLET, "").trim())
    .filter((l) => l.length > 0)
}

export function checklistToText(items: readonly string[]): string | null {
  const clean = items.map((i) => i.trim()).filter(Boolean)
  return clean.length > 0 ? clean.join("\n") : null
}

/**
 * Instrucciones efectivas de una pieza: las propias si existen; si no, el
 * checklist por defecto de su tipo de asset en el catálogo.
 */
export function instruccionesEfectivas(
  pieza: string | null | undefined,
  catalogo: string | null | undefined,
): { texto: string | null; origen: "pieza" | "catalogo" | null } {
  const propia = cleanText(pieza)
  if (propia) return { texto: propia, origen: "pieza" }
  const def = cleanText(catalogo)
  if (def) return { texto: def, origen: "catalogo" }
  return { texto: null, origen: null }
}

/** Normaliza un nombre de asset para comparar (sin tildes, signos ni mayúsculas). */
export function normalizarNombreAsset(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// ── Fechas de la pieza (zona Bogotá, fechas calendario) ──────────────────────

/** Hoy en Bogotá como AAAA-MM-DD. */
export function hoyBogota(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

function diasEntre(desde: string, hasta: string): number | null {
  const a = parseIsoDate(desde)
  const b = parseIsoDate(hasta)
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export type EstadoFechaLimite = "vencida" | "hoy" | "pronto" | "a_tiempo"

/** Estado de la fecha límite de insumos respecto a hoy (pronto = ≤ 3 días). */
export function estadoFechaLimite(
  fecha: string | null | undefined,
  hoy: string,
): EstadoFechaLimite | null {
  if (!fecha) return null
  const d = diasEntre(hoy, fecha.slice(0, 10))
  if (d === null) return null
  if (d < 0) return "vencida"
  if (d === 0) return "hoy"
  if (d <= 3) return "pronto"
  return "a_tiempo"
}

/** La fecha planeada solo se muestra al cliente si es hoy o futura. */
export function fechaPlaneadaVisible(
  fecha: string | null | undefined,
  hoy: string,
): string | null {
  if (!fecha) return null
  const d = diasEntre(hoy, fecha.slice(0, 10))
  return d !== null && d >= 0 ? fecha.slice(0, 10) : null
}
