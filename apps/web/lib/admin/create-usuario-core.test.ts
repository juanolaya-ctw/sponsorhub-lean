import { describe, expect, it, vi } from "vitest"
import {
  CREATE_USUARIO_FORBIDDEN,
  SPONSOR_NOT_IN_EVENTO,
  buildCrearUsuarioEventoHref,
} from "./create-usuario-guards"
import {
  runCreateUsuario,
  type CreateUsuarioAdmin,
  type CreateUsuarioDeps,
} from "./create-usuario-core"

const EVENTO_AISUMMIT = {
  id: "evt-aisummit",
  slug: "ai-summit",
  nombre: "Ai Summit",
}

const SPONSOR_AISUMMIT = {
  id: "sp-aisummit-1",
  nombre: "Sponsor Ai Summit",
  eventoId: EVENTO_AISUMMIT.id,
  eventoSlug: EVENTO_AISUMMIT.slug,
  eventoNombre: EVENTO_AISUMMIT.nombre,
}

const SPONSOR_OTRO = {
  id: "sp-otro",
  evento_id: "evt-otro",
}

const buildForm = (overrides: Record<string, string> = {}) => {
  const fd = new FormData()
  const values = {
    slug: EVENTO_AISUMMIT.slug,
    evento_id: EVENTO_AISUMMIT.id,
    email: "mock.user@example.test",
    password: "password123",
    password_confirm: "password123",
    sponsor_id: SPONSOR_AISUMMIT.id,
    nombre: "Mock User",
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) {
    fd.set(key, value)
  }
  return fd
}

const mockAdminForSponsor = (opts: {
  sponsorEventoId: string | null
  createUser?: ReturnType<typeof vi.fn>
  insert?: ReturnType<typeof vi.fn>
}): CreateUsuarioAdmin => {
  const createUser =
    opts.createUser ??
    vi.fn(async () => ({
      data: { user: { id: "auth-user-mock" } },
      error: null,
    }))
  const deleteUser = vi.fn(async () => ({ error: null }))
  const insert =
    opts.insert ??
    vi.fn(async () => ({ error: null }))

  return {
    from: (table: string) => {
      if (table === "sponsors") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: SPONSOR_AISUMMIT.id,
                  evento_id: opts.sponsorEventoId,
                },
                error: null,
              }),
            }),
          }),
          insert: async () => ({ error: null }),
        }
      }
      if (table === "sponsor_usuarios") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert,
        }
      }
      throw new Error(`tabla inesperada en mock: ${table}`)
    },
    auth: {
      admin: {
        createUser,
        deleteUser,
      },
    },
  }
}

describe("runCreateUsuario — acción de servidor (mocks)", () => {
  it("caso positivo: admin_ct + sponsor válido de evento ≠ GovTech desde panel", async () => {
    const href = buildCrearUsuarioEventoHref(SPONSOR_AISUMMIT)
    expect(href).toBe(
      `/admin/${EVENTO_AISUMMIT.slug}/usuarios?crear=1&sponsorId=${SPONSOR_AISUMMIT.id}`,
    )
    expect(href).not.toContain("govtech")

    const params = new URLSearchParams(href.split("?")[1])
    expect(params.get("crear")).toBe("1")
    expect(params.get("sponsorId")).toBe(SPONSOR_AISUMMIT.id)

    const createUser = vi.fn(async () => ({
      data: { user: { id: "auth-user-mock" } },
      error: null,
    }))
    const insert = vi.fn(async () => ({ error: null }))
    const revalidateUsuarios = vi.fn()
    const requireAdmin = vi.fn(async () => ({ rol: "admin_ct" }))

    const deps: CreateUsuarioDeps = {
      requireAdmin,
      getAdmin: () =>
        mockAdminForSponsor({
          sponsorEventoId: EVENTO_AISUMMIT.id,
          createUser,
          insert,
        }),
      revalidateUsuarios,
    }

    const form = buildForm({
      slug: EVENTO_AISUMMIT.slug,
      evento_id: EVENTO_AISUMMIT.id,
      sponsor_id: params.get("sponsorId")!,
    })

    const result = await runCreateUsuario(deps, form)

    expect(requireAdmin).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ error: null, success: true })
    expect(createUser).toHaveBeenCalledWith({
      email: "mock.user@example.test",
      password: "password123",
      email_confirm: true,
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "auth-user-mock",
        sponsor_id: SPONSOR_AISUMMIT.id,
        rol: "sponsor",
      }),
    )
    expect(revalidateUsuarios).toHaveBeenCalledWith(EVENTO_AISUMMIT.slug)
  })

  it("rechaza en la acción si el rol no es admin_ct", async () => {
    const deps: CreateUsuarioDeps = {
      requireAdmin: async () => ({ rol: "sponsor" }),
      getAdmin: () =>
        mockAdminForSponsor({ sponsorEventoId: EVENTO_AISUMMIT.id }),
      revalidateUsuarios: vi.fn(),
    }

    const result = await runCreateUsuario(deps, buildForm())
    expect(result.error).toBe(CREATE_USUARIO_FORBIDDEN)
  })

  it("rechaza en la acción sponsor de otro evento", async () => {
    const createUser = vi.fn()
    const deps: CreateUsuarioDeps = {
      requireAdmin: async () => ({ rol: "admin_ct" }),
      getAdmin: () =>
        mockAdminForSponsor({
          sponsorEventoId: SPONSOR_OTRO.evento_id,
          createUser,
        }),
      revalidateUsuarios: vi.fn(),
    }

    const result = await runCreateUsuario(deps, buildForm())
    expect(result.error).toBe(SPONSOR_NOT_IN_EVENTO)
    expect(createUser).not.toHaveBeenCalled()
  })
})
