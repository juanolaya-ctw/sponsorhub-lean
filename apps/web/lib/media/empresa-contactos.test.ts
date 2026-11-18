import { describe, expect, it } from "vitest"
import {
  MEDIA_CONTACTOS_TABLE_READY,
  contactosFromLegacyRow,
  legacyWriteBlockedReason,
  loadContactosForCrm,
  planPersistEmpresaContactos,
  resolveEmpresaNombre,
  toEmpresaCrmView,
  toLegacyClienteWrite,
} from "./empresa-contactos"

const contacto = (
  key: string,
  nombre: string,
): {
  key: string
  nombre: string
  email: string
  telefono: string
  cargo: string
} => ({
  key,
  nombre,
  email: "",
  telefono: "",
  cargo: "",
})

describe("resolveEmpresaNombre / contactosFromLegacyRow", () => {
  it("usa empresa como nombre de empresa y no asigna email al contacto", () => {
    const view = toEmpresaCrmView({
      id: "c1",
      nombre: "Natalia Murcia",
      empresa: "Colfondos",
      email_contacto: "x@example.com",
      telefono: "300",
    })
    expect(view.empresaNombre).toBe("Colfondos")
    expect(view.contactos).toHaveLength(1)
    expect(view.contactos[0]?.nombre).toBe("Natalia Murcia")
    expect(view.contactos[0]?.email).toBe("")
    expect(view.contactos[0]?.telefono).toBe("")
    expect(view.filaEmpresa.email).toBe("x@example.com")
    expect(view.dudas).toContain(
      "email_telefono_en_fila_empresa_sin_asignar_a_contacto",
    )
    expect(view.dudas).toContain("nombre_puede_ser_contacto_sin_confirmar")
  })

  it("no divide nombres por &", () => {
    const { contactos, dudas } = contactosFromLegacyRow({
      nombre: "Alejandra Suarez & Paola Ayala",
      empresa: "Gooms",
    })
    expect(contactos).toHaveLength(1)
    expect(contactos[0]?.nombre).toBe("Alejandra Suarez & Paola Ayala")
    expect(dudas).toContain("nombre_contiene_ampersand_no_dividir_sin_decision")
  })

  it("si empresa es null, usa nombre con duda", () => {
    const { empresaNombre, dudas } = resolveEmpresaNombre({
      nombre: "Solo Label",
      empresa: null,
    })
    expect(empresaNombre).toBe("Solo Label")
    expect(dudas).toContain("empresa_null_nombre_usado_como_etiqueta_empresa")
  })
})

describe("toLegacyClienteWrite", () => {
  it("guarda y recarga sin pérdida con un solo contacto (esquema vigente)", () => {
    const write = toLegacyClienteWrite({
      empresaNombre: "Colfondos",
      contactos: [
        {
          ...contacto("1", "Natalia Murcia"),
          email: "no-usar@x.com",
        },
        contacto("empty", "  "),
      ],
      filaEmail: "fila@empresa.com",
      filaTelefono: "300",
    })
    expect(write).toEqual({
      nombre: "Natalia Murcia",
      empresa: "Colfondos",
      email_contacto: "fila@empresa.com",
      telefono: "300",
    })
    if ("error" in write) throw new Error("unexpected error")

    const reloaded = toEmpresaCrmView({
      id: "c1",
      nombre: write.nombre,
      empresa: write.empresa,
      email_contacto: write.email_contacto,
      telefono: write.telefono,
    })
    expect(reloaded.empresaNombre).toBe("Colfondos")
    expect(reloaded.contactos).toHaveLength(1)
    expect(reloaded.contactos[0]?.nombre).toBe("Natalia Murcia")
    expect(reloaded.contactos[0]?.email).toBe("")
    expect(reloaded.filaEmpresa.email).toBe("fila@empresa.com")
    expect(reloaded.filaEmpresa.telefono).toBe("300")
  })

  it("con tabla lista no bloquea multi en legacyWriteBlockedReason", () => {
    expect(MEDIA_CONTACTOS_TABLE_READY).toBe(true)
    expect(
      legacyWriteBlockedReason([
        contacto("1", "Natalia Murcia"),
        contacto("2", "Otro"),
      ]),
    ).toBeNull()
  })

  it("exige empresa", () => {
    const write = toLegacyClienteWrite({
      empresaNombre: "  ",
      contactos: [],
      filaEmail: null,
      filaTelefono: null,
    })
    expect(write).toEqual({ error: "El nombre de empresa es requerido." })
  })

  it("planPersist en mode table conserva varios contactos sin descartar", () => {
    const plan = planPersistEmpresaContactos({
      empresaNombre: "Acme",
      contactos: [contacto("1", "Ana"), contacto("2", "Luis")],
      filaEmail: null,
      filaTelefono: null,
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.mode).toBe("table")
    expect(plan.contactos.map((c) => c.nombre)).toEqual(["Ana", "Luis"])
    expect(plan.legacy.empresa).toBe("Acme")
  })
})

describe("loadContactosForCrm", () => {
  it("consulta media_cliente_contactos cuando MEDIA_CONTACTOS_TABLE_READY=true", async () => {
    expect(MEDIA_CONTACTOS_TABLE_READY).toBe(true)
    let queried = false
    const view = await loadContactosForCrm(
      { nombre: "Persona", empresa: "Acme", email_contacto: null },
      {
        queryContactsTable: async () => {
          queried = true
          return [contacto("c1", "Ana")]
        },
      },
    )
    expect(queried).toBe(true)
    expect(view.empresaNombre).toBe("Acme")
    expect(view.contactos).toHaveLength(1)
    expect(view.contactos[0]?.nombre).toBe("Ana")
  })
})
