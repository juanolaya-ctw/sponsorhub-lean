import { describe, expect, it } from "vitest"
import { MEDIA_EMPRESA_CONTACTOS_READY } from "./media-contacto-auth"
import {
  authorizeDownloadMediaInsumo,
  authorizeUploadMediaInsumo,
  planUploadMediaInsumo,
  rejectMediaContactoPrivilege,
} from "./media-insumos"
import { planPersistEmpresaContactos } from "./empresa-contactos"

/**
 * Pruebas simuladas del flujo admin → contacto → portal → carga.
 * NO demuestran que RLS o Storage policies estén aplicadas en Postgres.
 */
describe("flujo admin→contacto→portal→insumo (mocks)", () => {
  const profile = {
    userId: "user-1",
    rol: "media_contacto",
    activo: true,
  }
  const links = [
    {
      contactoId: "contacto-1",
      clienteId: "empresa-a",
      authUserId: "user-1",
      activo: true,
    },
  ]

  it("flag activado habilita plan de upload de insumos", () => {
    expect(MEDIA_EMPRESA_CONTACTOS_READY).toBe(true)
    const plan = planUploadMediaInsumo({
      profile,
      links,
      ownership: {
        assetEjecutadoId: "pieza-1",
        clienteId: "empresa-a",
        billingCycleId: "ciclo-1",
      },
      clienteId: "empresa-a",
      assetEjecutadoId: "pieza-1",
      filename: "brief.pdf",
      uuid: "u-1",
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.mustNotChangeAssetEstado).toBe(true)
    expect(plan.storagePath).toContain("media-cliente/empresa-a/pieza-1/")
  })

  it("persiste varios contactos en plan table sin concatenar/descartar", () => {
    const planned = planPersistEmpresaContactos({
      empresaNombre: "Acme",
      contactos: [
        {
          key: "1",
          nombre: "Ana",
          email: "a@x.com",
          telefono: "",
          cargo: "",
        },
        {
          key: "2",
          nombre: "Luis",
          email: "l@x.com",
          telefono: "",
          cargo: "",
        },
      ],
      filaEmail: null,
      filaTelefono: null,
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.mode).toBe("table")
    expect(planned.contactos.map((c) => c.nombre)).toEqual(["Ana", "Luis"])
  })

  it("authorize upload: ok en empresa propia sin cambiar estado", () => {
    const plan = authorizeUploadMediaInsumo({
      profile,
      links,
      ownership: {
        assetEjecutadoId: "pieza-1",
        clienteId: "empresa-a",
        billingCycleId: "ciclo-1",
      },
      clienteId: "empresa-a",
      assetEjecutadoId: "pieza-1",
      filename: "brief.pdf",
      uuid: "u-1",
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.mustNotChangeAssetEstado).toBe(true)
    expect(plan.storagePath).toBe(
      "media-cliente/empresa-a/pieza-1/u-1-brief.pdf",
    )
    expect(plan.insert.cliente_id).toBe("empresa-a")
    expect(plan.insert.contacto_id).toBe("contacto-1")
  })

  it("authorize upload: rechaza otra empresa / otra pieza", () => {
    expect(
      authorizeUploadMediaInsumo({
        profile,
        links,
        ownership: {
          assetEjecutadoId: "pieza-1",
          clienteId: "empresa-a",
          billingCycleId: "ciclo-1",
        },
        clienteId: "empresa-b",
        assetEjecutadoId: "pieza-1",
        filename: "x.pdf",
        uuid: "u",
      }).ok,
    ).toBe(false)

    expect(
      authorizeUploadMediaInsumo({
        profile,
        links,
        ownership: {
          assetEjecutadoId: "pieza-1",
          clienteId: "empresa-b",
          billingCycleId: "ciclo-1",
        },
        clienteId: "empresa-a",
        assetEjecutadoId: "pieza-1",
        filename: "x.pdf",
        uuid: "u",
      }).ok,
    ).toBe(false)
  })

  it("authorize download: rechaza claimedClienteId / path spoofing", () => {
    const insumo = {
      id: "ins-1",
      assetEjecutadoId: "pieza-1",
      clienteId: "empresa-a",
      contactoId: "contacto-1",
      nombreArchivo: "brief.pdf",
      storagePath: "media-cliente/empresa-a/pieza-1/u-1-brief.pdf",
      subidoPor: "user-1",
      createdAt: "2026-01-01",
    }
    expect(
      authorizeDownloadMediaInsumo({
        profile,
        links,
        insumo,
      }).ok,
    ).toBe(true)
    expect(
      authorizeDownloadMediaInsumo({
        profile,
        links,
        insumo,
        claimedClienteId: "empresa-b",
      }).ok,
    ).toBe(false)
    expect(
      authorizeDownloadMediaInsumo({
        profile,
        links,
        insumo,
        claimedPath: "media-cliente/empresa-b/pieza-9/hack.pdf",
      }).ok,
    ).toBe(false)
  })

  it("rechaza privilegios (créditos/estado/permisos)", () => {
    expect(rejectMediaContactoPrivilege("cambiar_creditos").ok).toBe(false)
    expect(rejectMediaContactoPrivilege("aprobar_asset").ok).toBe(false)
    expect(rejectMediaContactoPrivilege("vincular_acceso").ok).toBe(false)
  })
})
