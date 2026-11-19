import { describe, expect, it } from "vitest"
import { generarPasswordSegura, validarPasswordNueva } from "./password"

describe("generarPasswordSegura", () => {
  it("cumple longitud y clases de caracteres, sin ambiguos", () => {
    for (let i = 0; i < 200; i++) {
      const p = generarPasswordSegura()
      expect(p).toHaveLength(16)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/[2-9]/)
      expect(p).toMatch(/[-_.!?]/)
      expect(p).not.toMatch(/[0O1lI]/)
    }
  })
  it("no repite", () => {
    const set = new Set(Array.from({ length: 100 }, () => generarPasswordSegura()))
    expect(set.size).toBe(100)
  })
})

describe("validarPasswordNueva", () => {
  it("valida mínimo y confirmación", () => {
    expect(validarPasswordNueva("corta", "corta")).toBeTruthy()
    expect(validarPasswordNueva("largaSuficiente1", "otra")).toBeTruthy()
    expect(validarPasswordNueva("largaSuficiente1", "largaSuficiente1")).toBeNull()
  })
})
