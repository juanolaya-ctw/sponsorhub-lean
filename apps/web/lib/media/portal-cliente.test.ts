import { describe, expect, it } from "vitest"
import {
  estadoCliente,
  formatFechaCorta,
  formatPeriodoCiclo,
  formatUsdTarifa,
  normalizeInstruccionesInsumos,
  numerarPiezas,
  resumenSaldo,
  tieneInstrucciones,
} from "./portal-cliente"

describe("resumenSaldo", () => {
  const pend = (c: number) => ({ costoCreditos: c, estado: "pendiente_insumos" })
  it("asignados a piezas ≠ usados; usados solo ejecutadas", () => {
    expect(
      resumenSaldo({
        asignados: 2500,
        extra: 6500,
        rollover: 0,
        piezas: [pend(4000), { costoCreditos: 2000, estado: "insumos_recibidos" }, { costoCreditos: 3000, estado: "pendiente_insumos" }],
      }),
    ).toEqual({
      pool: 9000,
      asignadosPiezas: 9000,
      usados: 0,
      disponibles: 0,
      porcentajeAsignado: 100,
      porcentajeUsado: 0,
    })
    const r = resumenSaldo({
      asignados: 100,
      extra: null,
      rollover: 20,
      piezas: [
        pend(10),
        { costoCreditos: 20, estado: "en_ejecucion" },
        { costoCreditos: 5, estado: "entregado" },
        { costoCreditos: 5, estado: "aprobado" },
        { costoCreditos: 50, estado: "cancelado" },
      ],
    })
    expect(r).toMatchObject({ pool: 120, asignadosPiezas: 40, usados: 30, disponibles: 80 })
  })
  it("disponibles no negativos y pool 0", () => {
    expect(resumenSaldo({ asignados: 10, piezas: [pend(15)] }).disponibles).toBe(0)
    expect(resumenSaldo({ asignados: 0, piezas: [] }).porcentajeAsignado).toBe(0)
  })
})

describe("numerarPiezas", () => {
  it("numera por created_at ascendente y desempata por id", () => {
    const out = numerarPiezas([
      { id: "c", createdAt: "2026-11-03T10:00:00Z" },
      { id: "b", createdAt: "2026-11-01T10:00:00Z" },
      { id: "a", createdAt: "2026-11-03T10:00:00Z" },
      { id: "z", createdAt: null },
    ])
    expect(out.map((p) => [p.id, p.numero])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
      ["z", 4],
    ])
  })
})

describe("formatPeriodoCiclo", () => {
  it("usa rango si hay fechas y mes si no", () => {
    expect(formatPeriodoCiclo({ periodo: "2026-11-01" })).toEqual({
      label: "noviembre de 2026",
      esRango: false,
    })
    const r = formatPeriodoCiclo({
      periodo: "2026-11-01",
      fechaInicio: "2026-11-01",
      fechaFin: "2027-01-31",
    })
    expect(r.esRango).toBe(true)
    expect(r.label).toContain("2026")
    expect(r.label).toContain("2027")
    expect(formatPeriodoCiclo({ periodo: "2026-11-01", fechaInicio: "2026-11-05" }).label).toMatch(/^Desde /)
  })
  it("fecha corta sin corrimiento de zona", () => {
    expect(formatFechaCorta("2026-11-01")).toContain("1")
    expect(formatFechaCorta("2026-02-31")).toBeNull()
    expect(formatFechaCorta(null)).toBeNull()
  })
})

describe("normalizeInstruccionesInsumos", () => {
  it("recorta y convierte vacíos en null", () => {
    const r = normalizeInstruccionesInsumos({
      instrucciones: "  Logo en alta  ",
      formato: "",
      fechaLimite: "",
    })
    expect(r).toEqual({
      ok: true,
      patch: { insumos_notas: "Logo en alta", insumos_formato: null, insumos_fecha_limite: null },
    })
  })
  it("valida fecha y longitudes", () => {
    expect(normalizeInstruccionesInsumos({ fechaLimite: "2026-13-01" }).ok).toBe(false)
    expect(normalizeInstruccionesInsumos({ instrucciones: "x".repeat(2001) }).ok).toBe(false)
    expect(normalizeInstruccionesInsumos({ formato: "x".repeat(201) }).ok).toBe(false)
    const ok = normalizeInstruccionesInsumos({ fechaLimite: "2026-11-30" })
    expect(ok.ok && ok.patch.insumos_fecha_limite).toBe("2026-11-30")
  })
  it("tieneInstrucciones", () => {
    expect(tieneInstrucciones({ instrucciones: "  " })).toBe(false)
    expect(tieneInstrucciones({ formato: "PDF" })).toBe(true)
  })
})

describe("estado y tarifa", () => {
  it("explica quién actúa", () => {
    expect(estadoCliente("pendiente_insumos").esTurnoCliente).toBe(true)
    expect(estadoCliente("en_ejecucion").esTurnoCliente).toBe(false)
    expect(estadoCliente("desconocido").label).toBe("Pendiente de insumos")
  })
  it("tarifa solo si existe", () => {
    expect(formatUsdTarifa(null)).toBeNull()
    expect(formatUsdTarifa(0.95)).toBe("$0.95")
    expect(formatUsdTarifa(0.875)).toBe("$0.875")
  })
})
