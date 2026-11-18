export type AcuerdosMontos = Array<number | null | undefined>

export type InversionSummary = {
  total: number | null
  isPartial: boolean
  knownCount: number
  missingCount: number
}

export type SaldoInput = {
  creditosAsignados: number
  creditosExtra: number
  creditosRollover: number
  creditosConsumidos: number
}

export type SaldoResult = {
  disponibles: number
  isValid: boolean
  breakdown: string
}

export type PeriodoDisplayInput = {
  fechaInicio?: string | null
  fechaFin?: string | null
  periodo?: string | null
}

export type PeriodoDisplay = {
  kind: "contrato" | "historico" | "sin_dato"
  label: string
}

/** Ciclo válido si tiene sponsor legacy y/o cliente CRM; sin inventar sponsors. */
export const hasCicloOwner = (input: {
  sponsorId?: string | null
  clienteId?: string | null
}): boolean => Boolean(input.sponsorId || input.clienteId)

const SIN_DATO = "Sin registrar"

/** True solo si hay tarifa numérica registrada (no inventar ni mostrar precio). */
export const hasTarifaRegistrada = (
  tarifa: number | null | undefined,
): boolean => typeof tarifa === "number" && Number.isFinite(tarifa)

const parseDateOnly = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

const formatMonthYear = (value: string): string => {
  const date = parseDateOnly(value) ?? new Date(`${value}T00:00:00`)
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" })
}

const formatDayMonthYear = (value: string): string => {
  const date = parseDateOnly(value) ?? new Date(`${value}T00:00:00`)
  return date.toLocaleDateString("es-CO", { dateStyle: "medium" })
}

const lastDayOfMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0)

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const isCalendarMonthRange = (
  fechaInicio: string,
  fechaFin: string,
): boolean => {
  const inicio = parseDateOnly(fechaInicio)
  const fin = parseDateOnly(fechaFin)
  if (!inicio || !fin) return false
  if (inicio.getDate() !== 1) return false
  return sameDay(fin, lastDayOfMonth(inicio))
}

/** Cierre mensual solo si no hay rango libre confirmado. */
export const isCierreMensualCompatible = (input: {
  fechaInicio?: string | null
  fechaFin?: string | null
}): boolean => {
  const { fechaInicio, fechaFin } = input
  if (!fechaInicio || !fechaFin) return true
  return isCalendarMonthRange(fechaInicio, fechaFin)
}

export const snapshotTarifaCredito = (
  tarifaCatalogo: number | null | undefined,
): number | null => {
  if (typeof tarifaCatalogo !== "number" || !Number.isFinite(tarifaCatalogo)) {
    return null
  }
  if (tarifaCatalogo < 0) return null
  return tarifaCatalogo
}

export const validateAcuerdoCampos = (input: {
  montoContratadoUsd: number | null
  creditosAsignados: number
  fechaInicio: string | null
  fechaFin: string | null
  /** Activación exige monto y fechas. Edición puede conservar NULL históricos. */
  requireContratoFields?: boolean
}): string | null => {
  const {
    montoContratadoUsd,
    creditosAsignados,
    fechaInicio,
    fechaFin,
    requireContratoFields = false,
  } = input

  if (
    !Number.isFinite(creditosAsignados) ||
    !Number.isInteger(creditosAsignados) ||
    creditosAsignados <= 0
  ) {
    return "Los créditos deben ser un entero mayor a 0."
  }

  const hasMonto =
    montoContratadoUsd !== null && montoContratadoUsd !== undefined
  const hasInicio = Boolean(fechaInicio && fechaInicio.trim())
  const hasFin = Boolean(fechaFin && fechaFin.trim())

  if (requireContratoFields) {
    if (!hasMonto || !Number.isFinite(montoContratadoUsd) || montoContratadoUsd <= 0) {
      return "El monto total contratado debe ser mayor a 0."
    }
    if (!hasInicio) return "La fecha de inicio no es válida."
    if (!hasFin) return "La fecha de fin no es válida."
  } else {
    if (hasMonto && (!Number.isFinite(montoContratadoUsd) || montoContratadoUsd <= 0)) {
      return "El monto total contratado debe ser mayor a 0."
    }
    if (hasInicio !== hasFin) {
      return "Completa ambas fechas del acuerdo o déjalas vacías (Sin registrar)."
    }
  }

  if (!hasInicio && !hasFin) return null

  const inicio = parseDateOnly((fechaInicio ?? "").trim())
  const fin = parseDateOnly((fechaFin ?? "").trim())
  if (!inicio) return "La fecha de inicio no es válida."
  if (!fin) return "La fecha de fin no es válida."
  if (fin < inicio) {
    return "La fecha de fin debe ser posterior o igual a la de inicio."
  }
  return null
}

export const calcularSaldoCreditos = (input: SaldoInput): SaldoResult => {
  const asignados = Number(input.creditosAsignados) || 0
  const extra = Number(input.creditosExtra) || 0
  const rollover = Number(input.creditosRollover) || 0
  const consumidos = Number(input.creditosConsumidos) || 0
  const disponibles = asignados + extra + rollover - consumidos
  const breakdown =
    `asignados ${asignados} + extra ${extra} + rollover ${rollover}` +
    ` − consumidos ${consumidos} = ${disponibles}`

  return {
    disponibles,
    isValid: disponibles >= 0,
    breakdown,
  }
}

export const validateEdicionCreditos = (
  input: SaldoInput,
): string | null => {
  if (
    !Number.isFinite(input.creditosAsignados) ||
    !Number.isInteger(input.creditosAsignados) ||
    input.creditosAsignados <= 0
  ) {
    return "Los créditos deben ser un entero mayor a 0."
  }

  const saldo = calcularSaldoCreditos(input)
  if (saldo.isValid) return null
  return (
    `La edición dejaría el saldo negativo (${saldo.breakdown}). ` +
    "Ajusta créditos asignados, top-ups o rollover; no se modifican consumos ni historial."
  )
}

export const summarizeInversion = (
  montos: AcuerdosMontos,
): InversionSummary => {
  let total = 0
  let knownCount = 0
  let missingCount = 0

  for (const monto of montos) {
    if (typeof monto === "number" && Number.isFinite(monto)) {
      total += monto
      knownCount += 1
      continue
    }
    missingCount += 1
  }

  return {
    total: knownCount > 0 ? total : null,
    isPartial: knownCount > 0 && missingCount > 0,
    knownCount,
    missingCount,
  }
}

export const formatMontoAcuerdo = (
  monto: number | null | undefined,
): string => {
  if (typeof monto !== "number" || !Number.isFinite(monto)) return SIN_DATO
  return monto.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const formatTarifaAcuerdo = (
  tarifa: number | null | undefined,
): string => {
  if (typeof tarifa !== "number" || !Number.isFinite(tarifa)) return SIN_DATO
  return `${tarifa.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })} / crédito`
}

export const formatPeriodoAcuerdo = (
  input: PeriodoDisplayInput,
): PeriodoDisplay => {
  const { fechaInicio, fechaFin, periodo } = input
  if (fechaInicio && fechaFin) {
    return {
      kind: "contrato",
      label: `${formatDayMonthYear(fechaInicio)} – ${formatDayMonthYear(fechaFin)}`,
    }
  }
  if (periodo) {
    return {
      kind: "historico",
      label: `Período histórico: ${formatMonthYear(periodo)}`,
    }
  }
  return { kind: "sin_dato", label: SIN_DATO }
}

export const formatInversionLabel = (
  summary: InversionSummary,
): string => {
  if (summary.total === null) return SIN_DATO
  const base = formatMontoAcuerdo(summary.total)
  return summary.isPartial ? `${base} (parcial)` : base
}
