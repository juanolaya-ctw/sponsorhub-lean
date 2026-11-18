import { describe, expect, it } from "vitest"
import {
  calcularSaldoCreditos,
  formatInversionLabel,
  formatMontoAcuerdo,
  formatPeriodoAcuerdo,
  formatTarifaAcuerdo,
  hasCicloOwner,
  hasTarifaRegistrada,
  isCierreMensualCompatible,
  snapshotTarifaCredito,
  summarizeInversion,
  validateAcuerdoCampos,
  validateEdicionCreditos,
} from "./acuerdo"

describe("calcularSaldoCreditos / validateEdicionCreditos", () => {
  it("secuencia base 100 / consumo 80: rechaza bajar a 50 y permite tras extra 40", () => {
    const base = {
      creditosExtra: 0,
      creditosRollover: 0,
      creditosConsumidos: 80,
    }
    expect(calcularSaldoCreditos({ ...base, creditosAsignados: 100 }).disponibles).toBe(20)
    expect(
      validateEdicionCreditos({ ...base, creditosAsignados: 50 }),
    ).toContain("saldo negativo")

    const conExtra = { ...base, creditosExtra: 40 }
    expect(calcularSaldoCreditos({ ...conExtra, creditosAsignados: 100 }).disponibles).toBe(60)
    expect(validateEdicionCreditos({ ...conExtra, creditosAsignados: 50 })).toBeNull()
    expect(calcularSaldoCreditos({ ...conExtra, creditosAsignados: 50 }).disponibles).toBe(10)
  })

  it("acepta saldo no negativo con top-ups y rollover cubriendo consumo", () => {
    const saldo = calcularSaldoCreditos({
      creditosAsignados: 500,
      creditosExtra: 300,
      creditosRollover: 200,
      creditosConsumidos: 900,
    })
    expect(saldo.disponibles).toBe(100)
    expect(saldo.isValid).toBe(true)
    expect(validateEdicionCreditos({
      creditosAsignados: 500,
      creditosExtra: 300,
      creditosRollover: 200,
      creditosConsumidos: 900,
    })).toBeNull()
  })

  it("no exige que los créditos base solos cubran el consumo", () => {
    const error = validateEdicionCreditos({
      creditosAsignados: 100,
      creditosExtra: 50,
      creditosRollover: 50,
      creditosConsumidos: 150,
    })
    expect(error).toBeNull()
  })

  it("rechaza edición que deja saldo negativo con desglose", () => {
    const error = validateEdicionCreditos({
      creditosAsignados: 100,
      creditosExtra: 20,
      creditosRollover: 10,
      creditosConsumidos: 200,
    })
    expect(error).toContain("saldo negativo")
    expect(error).toContain("asignados 100")
    expect(error).toContain("extra 20")
    expect(error).toContain("rollover 10")
    expect(error).toContain("consumidos 200")
  })
})

describe("snapshotTarifaCredito", () => {
  it("copia la tarifa del catálogo sin inventar", () => {
    expect(snapshotTarifaCredito(0.95)).toBe(0.95)
    expect(snapshotTarifaCredito(null)).toBeNull()
    expect(snapshotTarifaCredito(undefined)).toBeNull()
    expect(snapshotTarifaCredito(Number.NaN)).toBeNull()
  })

  it("no cambia el snapshot si después se edita el catálogo (inmutabilidad lógica)", () => {
    const snapshot = snapshotTarifaCredito(1)
    const catalogoDespues = 0.8
    expect(snapshot).toBe(1)
    expect(snapshot).not.toBe(catalogoDespues)
  })
})

describe("isCierreMensualCompatible", () => {
  it("permite cierre en históricos sin fechas de contrato", () => {
    expect(
      isCierreMensualCompatible({ fechaInicio: null, fechaFin: null }),
    ).toBe(true)
  })

  it("permite cierre en mes calendario completo", () => {
    expect(
      isCierreMensualCompatible({
        fechaInicio: "2026-03-01",
        fechaFin: "2026-03-31",
      }),
    ).toBe(true)
  })

  it("bloquea cierre en períodos libres", () => {
    expect(
      isCierreMensualCompatible({
        fechaInicio: "2026-03-15",
        fechaFin: "2026-06-15",
      }),
    ).toBe(false)
  })
})

describe("hasCicloOwner", () => {
  it("permite cliente sin sponsor y sponsor legacy sin cliente", () => {
    expect(hasCicloOwner({ clienteId: "c1", sponsorId: null })).toBe(true)
    expect(hasCicloOwner({ clienteId: null, sponsorId: "s1" })).toBe(true)
    expect(hasCicloOwner({ clienteId: "c1", sponsorId: "s1" })).toBe(true)
  })

  it("rechaza ciclo sin ningún dueño", () => {
    expect(hasCicloOwner({ clienteId: null, sponsorId: null })).toBe(false)
    expect(hasCicloOwner({})).toBe(false)
  })
})

describe("display e inversión parcial", () => {
  it("marca inversión parcial sin convertir faltantes en cero", () => {
    const summary = summarizeInversion([1000, null, 500])
    expect(summary.total).toBe(1500)
    expect(summary.isPartial).toBe(true)
    expect(formatInversionLabel(summary)).toContain("(parcial)")
    expect(formatMontoAcuerdo(null)).toBe("Sin registrar")
    expect(formatTarifaAcuerdo(undefined)).toBe("Sin registrar")
    expect(hasTarifaRegistrada(null)).toBe(false)
    expect(hasTarifaRegistrada(0.95)).toBe(true)
  })

  it("muestra período histórico cuando no hay fechas de contrato", () => {
    const display = formatPeriodoAcuerdo({
      fechaInicio: null,
      fechaFin: null,
      periodo: "2026-02-01",
    })
    expect(display.kind).toBe("historico")
    expect(display.label).toMatch(/Período histórico/i)
  })

  it("valida campos independientes del acuerdo", () => {
    expect(
      validateAcuerdoCampos({
        montoContratadoUsd: 2500,
        creditosAsignados: 2000,
        fechaInicio: "2026-01-10",
        fechaFin: "2026-04-10",
        requireContratoFields: true,
      }),
    ).toBeNull()
    expect(
      validateAcuerdoCampos({
        montoContratadoUsd: 2500,
        creditosAsignados: 2000,
        fechaInicio: "2026-04-10",
        fechaFin: "2026-01-10",
      }),
    ).toMatch(/fin/i)
  })

  it("en edición permite conservar monto/fechas NULL sin rellenarlos", () => {
    expect(
      validateAcuerdoCampos({
        montoContratadoUsd: null,
        creditosAsignados: 100,
        fechaInicio: null,
        fechaFin: null,
        requireContratoFields: false,
      }),
    ).toBeNull()
    expect(
      validateAcuerdoCampos({
        montoContratadoUsd: null,
        creditosAsignados: 100,
        fechaInicio: "2026-01-01",
        fechaFin: null,
      }),
    ).toMatch(/ambas fechas/i)
  })
})
