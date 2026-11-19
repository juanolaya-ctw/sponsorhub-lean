import { describe, expect, it } from "vitest"
import {
  MENSAJE_RESET_ENVIADO,
  runSolicitarReset,
  type ContactoParaReset,
} from "./reset-password-core"

const activo: ContactoParaReset = {
  contactoActivo: true,
  authUserId: "u1",
  profileRol: "media_contacto",
  profileActivo: true,
  authEmail: "ana@acme.com",
}

const run = async (contactos: ContactoParaReset[], email = "Ana@Acme.com ") => {
  const sent: string[] = []
  const r = await runSolicitarReset(
    {
      findContactosByEmail: async () => contactos,
      sendResetEmail: async (e) => {
        sent.push(e)
        return { error: null }
      },
    },
    email,
  )
  return { r, sent }
}

describe("runSolicitarReset", () => {
  it("envía a contacto vinculado y activo (email normalizado)", async () => {
    const { r, sent } = await run([activo])
    expect(sent).toEqual(["ana@acme.com"])
    expect(r.mensaje).toBe(MENSAJE_RESET_ENVIADO)
  })
  it("no envía a inactivos, otros roles o sin vínculo; mensaje genérico", async () => {
    for (const c of [
      { ...activo, contactoActivo: false },
      { ...activo, profileActivo: false },
      { ...activo, profileRol: "sponsor" },
      { ...activo, profileRol: "admin_ct" },
      { ...activo, authUserId: null },
      { ...activo, authEmail: "otro@acme.com" },
    ]) {
      const { r, sent } = await run([c])
      expect(sent).toHaveLength(0)
      expect(r.mensaje).toBe(MENSAJE_RESET_ENVIADO)
    }
    const { sent } = await run([])
    expect(sent).toHaveLength(0)
  })
  it("rechaza email inválido sin consultar", async () => {
    const { sent, r } = await run([activo], "no-es-email")
    expect(sent).toHaveLength(0)
    expect(r.mensaje).not.toBe(MENSAJE_RESET_ENVIADO)
  })
})
