import { describe, expect, it } from "vitest"
import {
  CREATE_USUARIO_FORBIDDEN,
  SPONSOR_NOT_IN_EVENTO,
  buildCrearUsuarioEventoHref,
  messageIfCannotCreateUsuario,
  messageIfSponsorOutsideEvento,
  sponsorBelongsToEvento,
} from "./create-usuario-guards"

describe("sponsorBelongsToEvento / messageIfSponsorOutsideEvento", () => {
  it("acepta sponsor del mismo evento", () => {
    expect(sponsorBelongsToEvento("evt-govtech", "evt-govtech")).toBe(true)
    expect(
      messageIfSponsorOutsideEvento("evt-govtech", "evt-govtech"),
    ).toBeNull()
  })

  it("rechaza sponsor de otro evento (mock)", () => {
    expect(sponsorBelongsToEvento("evt-otro", "evt-govtech")).toBe(false)
    expect(
      messageIfSponsorOutsideEvento("evt-otro", "evt-govtech"),
    ).toBe(SPONSOR_NOT_IN_EVENTO)
  })

  it("rechaza sponsor sin evento anclado", () => {
    expect(sponsorBelongsToEvento(null, "evt-govtech")).toBe(false)
    expect(messageIfSponsorOutsideEvento(undefined, "evt-govtech")).toBe(
      SPONSOR_NOT_IN_EVENTO,
    )
  })
})

describe("messageIfCannotCreateUsuario", () => {
  it("permite admin_ct", () => {
    expect(messageIfCannotCreateUsuario("admin_ct")).toBeNull()
  })

  it("rechaza usuario sin permiso (sponsor u otro rol)", () => {
    expect(messageIfCannotCreateUsuario("sponsor")).toBe(
      CREATE_USUARIO_FORBIDDEN,
    )
    expect(messageIfCannotCreateUsuario(null)).toBe(CREATE_USUARIO_FORBIDDEN)
    expect(messageIfCannotCreateUsuario(undefined)).toBe(
      CREATE_USUARIO_FORBIDDEN,
    )
  })
})

describe("buildCrearUsuarioEventoHref", () => {
  it("apunta a la vista por evento con sponsor preseleccionado", () => {
    expect(
      buildCrearUsuarioEventoHref({
        id: "sp-1",
        eventoSlug: "govtech",
      }),
    ).toBe("/admin/govtech/usuarios?crear=1&sponsorId=sp-1")
  })
})
