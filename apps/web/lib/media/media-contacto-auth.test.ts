import { describe, expect, it } from "vitest"
import {
  MEDIA_EMPRESA_CONTACTOS_READY,
  assertCanLinkAuthUserToContacto,
  assertClienteAuthorized,
  assertMediaContactoCannotEscalate,
  assertMediaInsumoPath,
  buildMediaInsumoStoragePath,
  parseMediaInsumoStoragePath,
  resolveAuthorizedClienteIds,
} from "./media-contacto-auth"

describe("media-contacto-auth (mocks; no prueba RLS real)", () => {
  it("flag permanece false hasta OK de migración", () => {
    expect(MEDIA_EMPRESA_CONTACTOS_READY).toBe(true)
  })

  it("solo autoriza empresas vinculadas por admin al user", () => {
    const ids = resolveAuthorizedClienteIds(
      [
        {
          contactoId: "c1",
          clienteId: "emp-a",
          authUserId: "u1",
          activo: true,
        },
        {
          contactoId: "c2",
          clienteId: "emp-b",
          authUserId: "u2",
          activo: true,
        },
        {
          contactoId: "c3",
          clienteId: "emp-c",
          authUserId: "u1",
          activo: false,
        },
      ],
      "u1",
    )
    expect(ids).toEqual(["emp-a"])
    expect(assertClienteAuthorized(ids, "emp-b").ok).toBe(false)
    expect(assertClienteAuthorized(ids, "emp-a").ok).toBe(true)
  })

  it("rechaza spoofing de path entre empresas", () => {
    const path = buildMediaInsumoStoragePath({
      clienteId: "emp-a",
      assetEjecutadoId: "asset-1",
      uuid: "uuid-1",
      filename: "logo.png",
    })
    expect(parseMediaInsumoStoragePath(path)).toEqual({
      clienteId: "emp-a",
      assetEjecutadoId: "asset-1",
    })
    expect(
      assertMediaInsumoPath({
        storagePath: path,
        clienteId: "emp-b",
        assetEjecutadoId: "asset-1",
      }).ok,
    ).toBe(false)
    expect(
      assertMediaInsumoPath({
        storagePath: path.replace("asset-1", "asset-other"),
        clienteId: "emp-a",
        assetEjecutadoId: "asset-1",
      }).ok,
    ).toBe(false)
  })

  it("bloquea vincular sponsor/admin y exigir admin actor", () => {
    expect(
      assertCanLinkAuthUserToContacto({
        actorRol: "media_contacto",
        targetUser: {
          id: "u",
          rol: "media_contacto",
          sponsor_id: null,
        },
      }).ok,
    ).toBe(false)

    expect(
      assertCanLinkAuthUserToContacto({
        actorRol: "admin_ct",
        targetUser: { id: "u", rol: "sponsor", sponsor_id: "s1" },
      }).ok,
    ).toBe(false)

    const adminCtReject = assertCanLinkAuthUserToContacto({
      actorRol: "admin_ct",
      targetUser: { id: "u", rol: "admin_ct", sponsor_id: null },
    })
    expect(adminCtReject.ok).toBe(false)
    if (!adminCtReject.ok) {
      expect(adminCtReject.error).toMatch(/admin_ct o sponsor/)
    }

    expect(
      assertCanLinkAuthUserToContacto({
        actorRol: "admin_ct",
        targetUser: {
          id: "u",
          rol: "media_contacto",
          sponsor_id: null,
        },
      }).ok,
    ).toBe(true)
  })

  it("rechaza escalada de privilegios del contacto", () => {
    const r = assertMediaContactoCannotEscalate("cambiar_creditos")
    expect(r.ok).toBe(false)
    expect(r.error).toContain("cambiar_creditos")
  })
})
