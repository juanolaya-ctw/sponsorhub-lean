import { describe, expect, it, vi } from "vitest"
import {
  runCreateOrLinkMediaContacto,
  runGenerateMediaContactoAccessLink,
  type MediaContactoAdmin,
} from "./create-media-contacto-core"

type Row = Record<string, unknown>

const makeAdmin = (opts: {
  contacto?: Row | null
  profileById?: Record<string, Row>
  authUsers?: { id: string; email: string }[]
  dupLink?: Row | null
  failLink?: boolean
  failInsertProfile?: boolean
}) => {
  const createdUsers: string[] = []
  const deletedUsers: string[] = []
  const contactosStore = new Map<string, Row>()
  if (opts.contacto) {
    contactosStore.set(String(opts.contacto.id), { ...opts.contacto })
  }

  const filterContactos = (filters: Record<string, string | boolean>) => {
    for (const row of contactosStore.values()) {
      let ok = true
      for (const [k, v] of Object.entries(filters)) {
        if (row[k] !== v) ok = false
      }
      if (ok) return row
    }
    // also allow querying dup by auth_user_id without being in store
    if (opts.dupLink && filters.auth_user_id) return opts.dupLink
    return null
  }

  const admin: MediaContactoAdmin = {
    from: (table: string) => {
      if (table === "media_cliente_contactos") {
        const filters: Record<string, string | boolean> = {}
        const builder = {
          eq: (col: string, val: string | boolean) => {
            filters[col] = val
            return builder
          },
          maybeSingle: async () => ({
            data: filterContactos(filters),
            error: null,
          }),
        }
        return {
          select: () => builder,
          insert: async () => ({ error: null }),
          update: (row: Row) => {
            const updFilters: Record<string, string> = {}
            return {
              eq: (col: string, val: string) => {
                updFilters[col] = val
                return {
                  eq: async (col2: string, val2: string) => {
                    updFilters[col2] = val2
                    if (opts.failLink) {
                      return { error: { message: "link failed" } }
                    }
                    const id = updFilters.id
                    if (id) {
                      const existing = contactosStore.get(id) ?? {}
                      contactosStore.set(id, { ...existing, ...row })
                    }
                    return { error: null }
                  },
                }
              },
            }
          },
        }
      }

      if (table === "sponsor_usuarios") {
        return {
          select: () => {
            const filters: Record<string, string | boolean> = {}
            const builder = {
              eq: (col: string, val: string | boolean) => {
                filters[col] = val
                return builder
              },
              maybeSingle: async () => {
                const id = String(filters.id ?? "")
                return {
                  data: opts.profileById?.[id] ?? null,
                  error: null,
                }
              },
            }
            return builder
          },
          insert: async () => ({
            error: opts.failInsertProfile
              ? { message: "profile insert failed" }
              : null,
          }),
          update: () => ({
            eq: (_col: string, _val: string) => ({
              eq: async () => ({ error: null }),
            }),
          }),
        }
      }

      throw new Error(`unexpected table ${table}`)
    },
    auth: {
      admin: {
        createUser: async ({ email }) => {
          const id = `new-${email}`
          createdUsers.push(id)
          return { data: { user: { id } }, error: null }
        },
        deleteUser: async (id) => {
          deletedUsers.push(id)
          return { error: null }
        },
        getUserById: async (id) => {
          const fromList = (opts.authUsers ?? []).find((u) => u.id === id)
          if (fromList) {
            return {
              data: { user: { id: fromList.id, email: fromList.email } },
              error: null,
            }
          }
          const profile = opts.profileById?.[id]
          if (profile) {
            return {
              data: {
                user: {
                  id,
                  email: (profile.email as string | undefined) ?? null,
                },
              },
              error: null,
            }
          }
          return { data: { user: null }, error: { message: "not found" } }
        },
        listUsers: async () => ({
          data: { users: opts.authUsers ?? [] },
          error: null,
        }),
        generateLink: async ({ email }) => ({
          data: {
            properties: {
              action_link: `https://example.test/auth/v1/verify?email=${encodeURIComponent(email)}`,
            },
            user: { id: "link-user" },
          },
          error: null,
        }),
      },
    },
  }

  return { admin, createdUsers, deletedUsers, contactosStore }
}

describe("runCreateOrLinkMediaContacto (mocks; sin Auth real)", () => {
  it("rechaza no-admin", async () => {
    const { admin } = makeAdmin({})
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "sponsor" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "create",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "a@x.com",
        password: "password1",
        passwordConfirm: "password1",
      },
    )
    expect(result.error).toMatch(/No autorizado/)
  })

  it("crea y vincula media_contacto nuevo", async () => {
    const { admin, createdUsers, contactosStore } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: "ana@acme.com",
      },
    })
    const revalidate = vi.fn()
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate,
      },
      {
        mode: "create",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "ana@acme.com",
        password: "password1",
        passwordConfirm: "password1",
        nombre: "Ana",
      },
    )
    expect(result.error).toBeNull()
    expect(result.success).toBe(true)
    expect(result.createdAuthUser).toBe(true)
    expect(createdUsers).toHaveLength(1)
    expect(contactosStore.get("c1")?.auth_user_id).toBe(createdUsers[0])
    expect(revalidate).toHaveBeenCalledWith("emp-a")
    expect(result.inviteQueued).toBe(false)
  })

  it("rechaza crear si el email Auth ya existe", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: null,
      },
      authUsers: [{ id: "u-existing", email: "ana@acme.com" }],
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "create",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "ana@acme.com",
        password: "password1",
        passwordConfirm: "password1",
      },
    )
    expect(result.error).toMatch(/Ya existe/)
  })

  it("vincula existente media_contacto por email exacto", async () => {
    const { admin, contactosStore } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: "ana@acme.com",
      },
      authUsers: [{ id: "u1", email: "ana@acme.com" }],
      profileById: {
        u1: {
          id: "u1",
          rol: "media_contacto",
          sponsor_id: null,
          activo: true,
        },
      },
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "link",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "ana@acme.com",
      },
    )
    expect(result.error).toBeNull()
    expect(result.createdAuthUser).toBe(false)
    expect(contactosStore.get("c1")?.auth_user_id).toBe("u1")
  })

  it("rechaza vincular sponsor (no romper usuarios actuales)", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: null,
      },
      authUsers: [{ id: "u-sp", email: "sp@x.com" }],
      profileById: {
        "u-sp": {
          id: "u-sp",
          rol: "sponsor",
          sponsor_id: "s1",
          activo: true,
        },
      },
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "link",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "sp@x.com",
      },
    )
    expect(result.error).toMatch(/admin_ct o sponsor/)
  })

  it("rechaza vincular admin_ct existente sin cambiar rol ni vínculos", async () => {
    const profileById: Record<string, Row> = {
      "u-adm": {
        id: "u-adm",
        rol: "admin_ct",
        sponsor_id: null,
        activo: true,
      },
    }
    const { admin, contactosStore } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: null,
      },
      authUsers: [{ id: "u-adm", email: "admin@ct.com" }],
      profileById,
    })
    const profileBefore = { ...profileById["u-adm"] }
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "link",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "admin@ct.com",
      },
    )
    expect(result.error).toMatch(/admin_ct o sponsor/)
    expect(profileById["u-adm"]).toEqual(profileBefore)
    expect(contactosStore.get("c1")?.auth_user_id).toBeNull()
  })

  it("rechaza acceso cruzado: contacto de otra empresa", async () => {
    const { admin } = makeAdmin({
      contacto: null, // no match emp-b + c1
    })
    // seed contacto only for emp-a
    const seeded = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: "ana@acme.com",
      },
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => seeded.admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "link",
        clienteId: "emp-b",
        contactoId: "c1",
        email: "ana@acme.com",
      },
    )
    expect(result.error).toMatch(/Contacto no encontrado/)
    expect(admin).toBeTruthy()
  })

  it("rollback auth si falla el vínculo tras create", async () => {
    const { admin, createdUsers, deletedUsers } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: null,
      },
      failLink: true,
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => true,
        revalidate: () => undefined,
      },
      {
        mode: "create",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "nuevo@acme.com",
        password: "password1",
        passwordConfirm: "password1",
      },
    )
    expect(result.error).toBe("link failed")
    expect(createdUsers).toHaveLength(1)
    expect(deletedUsers).toEqual(createdUsers)
  })

  it("con flag apagado no crea nada", async () => {
    const { admin, createdUsers } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: null,
      },
    })
    const result = await runCreateOrLinkMediaContacto(
      {
        requireAdmin: async () => ({ rol: "admin_ct" }),
        getAdmin: () => admin,
        isReady: () => false,
        revalidate: () => undefined,
      },
      {
        mode: "create",
        clienteId: "emp-a",
        contactoId: "c1",
        email: "a@x.com",
        password: "password1",
        passwordConfirm: "password1",
      },
    )
    expect(result.error).toMatch(/no activado/)
    expect(createdUsers).toHaveLength(0)
  })
})

describe("generar enlace de acceso Media", () => {
  const linkedDeps = (admin: MediaContactoAdmin) => ({
    requireAdmin: async () => ({ rol: "admin_ct" as const }),
    getAdmin: () => admin,
    isReady: () => true,
    revalidate: () => undefined,
    getAccessLinkRedirectTo: () => "http://localhost:3000/portal/media",
    getAccessLinkExpiryHint: () => "hint-test",
  })

  it("genera magiclink para contacto media_contacto vinculado", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: "u1",
        email: "ana@acme.com",
      },
      profileById: {
        u1: { id: "u1", rol: "media_contacto", activo: true },
      },
      authUsers: [{ id: "u1", email: "ana@acme.com" }],
    })
    const result = await runGenerateMediaContactoAccessLink(
      linkedDeps(admin),
      { clienteId: "emp-a", contactoId: "c1" },
    )
    expect(result.error).toBeNull()
    expect(result.success).toBe(true)
    expect(typeof result.accessLink).toBe("string")
    expect(result.accessLink!.startsWith("https://")).toBe(true)
    expect(result.accessLinkExpiryHint).toBe("hint-test")
    expect(result.accessLink).not.toContain("password")
  })

  it("rechaza no-admin", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: "u1",
        email: "ana@acme.com",
      },
    })
    const result = await runGenerateMediaContactoAccessLink(
      {
        ...linkedDeps(admin),
        requireAdmin: async () => ({ rol: "sponsor" }),
      },
      { clienteId: "emp-a", contactoId: "c1" },
    )
    expect(result.error).toMatch(/No autorizado/)
    expect(result.accessLink).toBeUndefined()
  })

  it("rechaza contacto sin vínculo", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: null,
        email: "ana@acme.com",
      },
    })
    const result = await runGenerateMediaContactoAccessLink(
      linkedDeps(admin),
      { clienteId: "emp-a", contactoId: "c1" },
    )
    expect(result.error).toMatch(/antes de generar/)
    expect(result.accessLink).toBeUndefined()
  })

  it("rechaza roles distintos de media_contacto", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: "u1",
        email: "ana@acme.com",
      },
      profileById: {
        u1: { id: "u1", rol: "sponsor", activo: true },
      },
      authUsers: [{ id: "u1", email: "ana@acme.com" }],
    })
    const result = await runGenerateMediaContactoAccessLink(
      linkedDeps(admin),
      { clienteId: "emp-a", contactoId: "c1" },
    )
    expect(result.error).toMatch(/Solo se genera enlace para contactos Media/)
    expect(result.accessLink).toBeUndefined()
  })

  it("rechaza cliente/contacto que no coinciden", async () => {
    const { admin } = makeAdmin({
      contacto: {
        id: "c1",
        cliente_id: "emp-a",
        activo: true,
        auth_user_id: "u1",
        email: "ana@acme.com",
      },
    })
    const result = await runGenerateMediaContactoAccessLink(
      linkedDeps(admin),
      { clienteId: "otra-emp", contactoId: "c1" },
    )
    expect(result.error).toMatch(/no encontrado/i)
    expect(result.accessLink).toBeUndefined()
  })
})
