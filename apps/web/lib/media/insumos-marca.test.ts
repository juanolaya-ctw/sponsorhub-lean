import { describe, expect, it } from "vitest"
import {
  assertMarcaPath,
  authorizeDownloadMarcaContacto,
  authorizeUploadMarcaContacto,
  buildMarcaStoragePath,
  clasificarChecklist,
  isMissingTableError,
  piezaEsperaAlCliente,
  planUploadMarcaAdmin,
  tipoMarcaDeItem,
  ultimoPorTipo,
  type ArchivoMarca,
} from "./insumos-marca"

const C = "cli-1"
const profile = { userId: "u1", rol: "media_contacto", activo: true }
const links = [{ contactoId: "k1", clienteId: C, authUserId: "u1", activo: true }]

describe("tipoMarcaDeItem (checklist Notion)", () => {
  it("reconoce los ítems reutilizables", () => {
    expect(tipoMarcaDeItem("Logo Original (png)")).toBe("logo_original")
    expect(tipoMarcaDeItem("Logo Blanco/Negro (png)")).toBe("logo_bn")
    expect(tipoMarcaDeItem("Manual Marca")).toBe("manual_marca")
  })
  it("la foto del vocero es por pieza", () => {
    expect(tipoMarcaDeItem("Foto Vocero: 1.200 × 1.200 px")).toBeNull()
    expect(tipoMarcaDeItem("Foto del vocero: 1.200 × 1.200 px.")).toBeNull()
  })
  it("reconoce los textos pulidos del catálogo", () => {
    expect(tipoMarcaDeItem("Logo original (PNG).")).toBe("logo_original")
    expect(tipoMarcaDeItem("Logo blanco/negro (PNG).")).toBe("logo_bn")
    expect(tipoMarcaDeItem("Manual de marca.")).toBe("manual_marca")
    expect(tipoMarcaDeItem("Vocero: nombre, cargo, perfil de LinkedIn y bio corta.")).toBeNull()
    expect(
      tipoMarcaDeItem(
        "Imagen que represente visualmente a la marca (espacio, persona o persona en contexto); también puede ser el logo integrado de forma natural en una superficie o infraestructura. Formato: 1.080 × 1.350 px.",
      ),
    ).toBeNull()
  })
  it("no marca ítems propios de la pieza", () => {
    expect(tipoMarcaDeItem("CTA: 2-3 palabras")).toBeNull()
    expect(tipoMarcaDeItem("Vocero: nombre cargo linkedin y bio corta")).toBeNull()
    expect(tipoMarcaDeItem("Imagen que represente visualmente a la marca")).toBeNull()
    expect(tipoMarcaDeItem("Objetivo: qué quieren lograr. (50 palabras)")).toBeNull()
  })
})

const logo: ArchivoMarca = {
  id: "a1",
  clienteId: C,
  tipo: "logo_original",
  nombreArchivo: "logo.png",
  storagePath: `media-cliente/${C}/marca/logo_original/x-logo.png`,
  createdAt: "2026-11-01T00:00:00Z",
}

describe("ultimoPorTipo / clasificar", () => {
  it("el más reciente gana", () => {
    const nuevo = { ...logo, id: "a2", createdAt: "2026-11-02T00:00:00Z" }
    expect(ultimoPorTipo([nuevo, logo]).get("logo_original")?.id).toBe("a2")
    expect(ultimoPorTipo([logo, nuevo]).get("logo_original")?.id).toBe("a2")
  })
  it("marca cargado solo lo que existe a nivel empresa", () => {
    const items = clasificarChecklist(
      "Logo Original (png)\nLogo Blanco/Negro (png)\nCTA: 2-3 palabras",
      ultimoPorTipo([logo]),
    )
    expect(items.map((i) => [i.tipo, Boolean(i.cargado)])).toEqual([
      ["logo_original", true],
      ["logo_bn", false],
      [null, false],
    ])
  })
})

describe("piezaEsperaAlCliente", () => {
  const cargados = ultimoPorTipo([logo])
  it("no insiste si solo faltaban insumos de marca ya cargados", () => {
    const items = clasificarChecklist("Logo Original (png)", cargados)
    expect(piezaEsperaAlCliente({ estado: "pendiente_insumos", items, archivosPieza: 0 })).toBe(false)
  })
  it("insiste si falta marca", () => {
    const items = clasificarChecklist("Logo Original (png)\nManual Marca", cargados)
    expect(piezaEsperaAlCliente({ estado: "pendiente_insumos", items, archivosPieza: 3 })).toBe(true)
  })
  it("ítems propios: insiste hasta que suba algo a la pieza", () => {
    const items = clasificarChecklist("Logo Original (png)\nCTA: 2-3 palabras", cargados)
    expect(piezaEsperaAlCliente({ estado: "pendiente_insumos", items, archivosPieza: 0 })).toBe(true)
    expect(piezaEsperaAlCliente({ estado: "pendiente_insumos", items, archivosPieza: 1 })).toBe(false)
  })
  it("sin checklist y fuera de pendiente_insumos", () => {
    expect(piezaEsperaAlCliente({ estado: "pendiente_insumos", items: [], archivosPieza: 0 })).toBe(true)
    const items = clasificarChecklist("Manual Marca", cargados)
    expect(piezaEsperaAlCliente({ estado: "en_ejecucion", items, archivosPieza: 0 })).toBe(false)
  })
})

describe("paths y autorización", () => {
  it("path canónico por empresa/tipo", () => {
    const p = buildMarcaStoragePath({ clienteId: C, tipo: "manual_marca", uuid: "u", filename: "Manual Ñ.pdf" })
    expect(p).toBe(`media-cliente/${C}/marca/manual_marca/u-Manual-N.pdf`)
    expect(assertMarcaPath({ storagePath: p, clienteId: C, tipo: "manual_marca" }).ok).toBe(true)
    expect(assertMarcaPath({ storagePath: p, clienteId: "otro" }).ok).toBe(false)
    expect(assertMarcaPath({ storagePath: `media-cliente/${C}/pieza-1/x.png`, clienteId: C }).ok).toBe(false)
  })
  it("contacto solo sube a su empresa y tipos válidos", () => {
    const base = { profile, links, filename: "l.png", uuid: "u" }
    expect(authorizeUploadMarcaContacto({ ...base, clienteId: C, tipo: "logo_bn" }).ok).toBe(true)
    expect(authorizeUploadMarcaContacto({ ...base, clienteId: "otra", tipo: "logo_bn" }).ok).toBe(false)
    expect(authorizeUploadMarcaContacto({ ...base, clienteId: C, tipo: "creditos" }).ok).toBe(false)
    expect(
      authorizeUploadMarcaContacto({ ...base, profile: { ...profile, rol: "sponsor" }, clienteId: C, tipo: "logo_bn" }).ok,
    ).toBe(false)
  })
  it("admin: tipo válido", () => {
    expect(planUploadMarcaAdmin({ clienteId: C, tipo: "manual_marca", filename: "f.jpg", uuid: "u", userId: "adm" }).ok).toBe(true)
    expect(planUploadMarcaAdmin({ clienteId: C, tipo: "foto_vocero", filename: "f.jpg", uuid: "u", userId: "adm" }).ok).toBe(false)
    expect(planUploadMarcaAdmin({ clienteId: C, tipo: "x", filename: "f.jpg", uuid: "u", userId: "adm" }).ok).toBe(false)
  })
  it("descarga solo de empresa vinculada", () => {
    expect(authorizeDownloadMarcaContacto({ profile, links, archivo: logo }).ok).toBe(true)
    expect(authorizeDownloadMarcaContacto({ profile, links, archivo: { ...logo, clienteId: "otra" } }).ok).toBe(false)
    expect(authorizeDownloadMarcaContacto({ profile, links, archivo: null }).ok).toBe(false)
  })
  it("detecta tabla ausente", () => {
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true)
    expect(isMissingTableError({ code: "23505" })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })
})
