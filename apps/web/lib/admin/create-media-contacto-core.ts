import { messageIfCannotCreateUsuario } from "@/lib/admin/create-usuario-guards"
import {
  MEDIA_EMPRESA_CONTACTOS_READY,
  assertCanLinkAuthUserToContacto,
} from "@/lib/media/media-contacto-auth"

export type MediaContactoAccessState = {
  error: string | null
  success?: boolean
  userId?: string
  contactoId?: string
  /** @deprecated sustituido por accessLink; no usar para UI nueva */
  inviteQueued?: boolean
  createdAuthUser?: boolean
  /**
   * Enlace magiclink solo para el admin que lo solicitó (respuesta en memoria).
   * No persistir, cachear ni registrar.
   */
  accessLink?: string
  /** Aviso de caducidad según configuración Auth (sin exponer secretos). */
  accessLinkExpiryHint?: string
}

type QueryResult = {
  data: Record<string, unknown> | null
  error: { message: string } | null
}

type FilterBuilder = {
  eq: (column: string, value: string | boolean) => FilterBuilder
  maybeSingle: () => Promise<QueryResult>
}

type UpdateFilter = {
  eq: (
    column: string,
    value: string,
  ) => Promise<{ error: { message: string } | null }>
}

type UpdateBuilder = {
  eq: (column: string, value: string) => UpdateFilter
}

export type MediaContactoAdmin = {
  from: (table: string) => {
    select: (columns: string) => FilterBuilder
    insert: (row: Record<string, unknown>) => Promise<{
      error: { message: string } | null
    }>
    update: (row: Record<string, unknown>) => UpdateBuilder
  }
  auth: {
    admin: {
      createUser: (input: {
        email: string
        password: string
        email_confirm: boolean
      }) => Promise<{
        data: { user: { id: string } | null }
        error: { message: string } | null
      }>
      deleteUser: (id: string) => Promise<{ error: { message: string } | null }>
      getUserById: (id: string) => Promise<{
        data: { user: { id: string; email?: string | null } | null }
        error: { message: string } | null
      }>
      listUsers: (args?: {
        page?: number
        perPage?: number
      }) => Promise<{
        data: { users: { id: string; email?: string | null }[] }
        error: { message: string } | null
      }>
      generateLink: (params: {
        type: "magiclink"
        email: string
        options?: { redirectTo?: string }
      }) => Promise<{
        data: {
          properties?: { action_link?: string | null } | null
          user?: { id?: string } | null
        }
        error: { message: string } | null
      }>
    }
  }
}

export type CreateMediaContactoDeps = {
  requireAdmin: () => Promise<{ rol: string }>
  getAdmin: () => MediaContactoAdmin
  /** Flag de activación; tests pueden forzar true sin tocar el const de prod */
  isReady?: () => boolean
  revalidate: (clienteId: string) => void
  /** Origen absoluto permitido para redirectTo del magiclink (p. ej. site URL). */
  getAccessLinkRedirectTo?: () => string
  /** Texto de caducidad alineado a la config Auth real (sin secretos). */
  getAccessLinkExpiryHint?: () => string
}

export const DEFAULT_MEDIA_ACCESS_LINK_EXPIRY_HINT =
  "Un solo uso. Caduca según la configuración de Auth del proyecto (OTP / magic link)."

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type CreateMediaContactoInput = {
  clienteId: string
  contactoId: string
  email: string
  password?: string
  passwordConfirm?: string
  nombre?: string | null
  cargo?: string | null
  telefono?: string | null
  mode: "create" | "link"
  queueInvite?: boolean
}

const findAuthUserIdByEmail = async (
  admin: MediaContactoAdmin,
  email: string,
): Promise<{ userId: string | null; error: string | null }> => {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (error) return { userId: null, error: error.message }
  const matches = (data.users ?? []).filter(
    (u) => (u.email ?? "").trim().toLowerCase() === email,
  )
  if (matches.length === 0) return { userId: null, error: null }
  if (matches.length > 1) {
    return {
      userId: null,
      error: "Email ambiguo en Auth; no se vincula por coincidencia insegura.",
    }
  }
  return { userId: matches[0]!.id, error: null }
}

/**
 * Alta o vínculo de acceso media_contacto.
 * Patrón createUser + rollback como create-usuario-core.
 * No envía invitaciones; queueInvite solo deja constancia explícita.
 */
export const runCreateOrLinkMediaContacto = async (
  deps: CreateMediaContactoDeps,
  input: CreateMediaContactoInput,
): Promise<MediaContactoAccessState> => {
  const auth = await deps.requireAdmin()
  const forbidden = messageIfCannotCreateUsuario(auth.rol)
  if (forbidden) return { error: forbidden }

  const ready = deps.isReady ? deps.isReady() : MEDIA_EMPRESA_CONTACTOS_READY
  if (!ready) {
    return {
      error:
        "Flujo media_contacto no activado (migración 0024 + flag pendientes).",
    }
  }

  const clienteId = input.clienteId.trim()
  const contactoId = input.contactoId.trim()
  const email = input.email.trim().toLowerCase()

  if (!clienteId || !contactoId) {
    return { error: "clienteId y contactoId son requeridos." }
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "El email no es válido." }
  }

  const admin = deps.getAdmin()

  const { data: contacto, error: contactoError } = await admin
    .from("media_cliente_contactos")
    .select("id, cliente_id, activo, auth_user_id, email")
    .eq("id", contactoId)
    .eq("cliente_id", clienteId)
    .maybeSingle()

  if (contactoError) return { error: contactoError.message }
  if (!contacto || contacto.activo === false) {
    return { error: "Contacto no encontrado en esta empresa." }
  }
  if (contacto.auth_user_id) {
    return {
      error: "Este contacto ya tiene acceso vinculado. Desvincula antes.",
    }
  }

  const contactoEmail = String(contacto.email ?? "")
    .trim()
    .toLowerCase()
  if (contactoEmail && contactoEmail !== email) {
    return {
      error:
        "El email no coincide con el del contacto. Actualiza el contacto o usa el email registrado.",
    }
  }

  let userId: string | null = null
  let createdAuthUser = false

  if (input.mode === "link") {
    const found = await findAuthUserIdByEmail(admin, email)
    if (found.error) return { error: found.error }
    if (!found.userId) {
      return {
        error:
          "No hay usuario Auth con ese email. Usa modo crear o crea el usuario antes.",
      }
    }
    userId = found.userId

    const { data: profile, error: profileError } = await admin
      .from("sponsor_usuarios")
      .select("id, rol, sponsor_id, activo")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) return { error: profileError.message }

    const linkCheck = assertCanLinkAuthUserToContacto({
      actorRol: auth.rol,
      targetUser: profile
        ? {
            id: profile.id as string,
            rol: profile.rol as string,
            sponsor_id: (profile.sponsor_id as string | null) ?? null,
          }
        : null,
    })
    if (!linkCheck.ok) return { error: linkCheck.error }
    if (profile?.activo === false) {
      return { error: "El usuario está desactivado." }
    }

    const { data: dup, error: dupError } = await admin
      .from("media_cliente_contactos")
      .select("id")
      .eq("auth_user_id", userId)
      .eq("cliente_id", clienteId)
      .eq("activo", true)
      .maybeSingle()
    if (dupError) return { error: dupError.message }
    if (dup) {
      return {
        error: "Ese usuario ya está vinculado a un contacto de esta empresa.",
      }
    }
  } else {
    const password = input.password ?? ""
    const passwordConfirm = input.passwordConfirm ?? ""
    if (password.length < 8) {
      return { error: "La contraseña debe tener al menos 8 caracteres." }
    }
    if (password !== passwordConfirm) {
      return { error: "Las contraseñas no coinciden." }
    }

    const existing = await findAuthUserIdByEmail(admin, email)
    if (existing.error) return { error: existing.error }
    if (existing.userId) {
      return {
        error:
          "Ya existe un usuario Auth con ese email. Usa modo vincular, no crear.",
      }
    }

    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError || !authData.user) {
      return {
        error: authError?.message ?? "No se pudo crear el usuario en Auth.",
      }
    }

    userId = authData.user.id
    createdAuthUser = true

    const { error: insertError } = await admin.from("sponsor_usuarios").insert({
      id: userId,
      sponsor_id: null,
      rol: "media_contacto",
      activo: true,
      nombre: input.nombre ?? null,
      cargo: input.cargo ?? null,
      telefono: input.telefono ?? null,
    })

    if (insertError) {
      await admin.auth.admin.deleteUser(userId)
      return { error: insertError.message }
    }
  }

  if (!userId) return { error: "No se resolvió el usuario." }

  const { error: linkError } = await admin
    .from("media_cliente_contactos")
    .update({ auth_user_id: userId, email })
    .eq("id", contactoId)
    .eq("cliente_id", clienteId)

  if (linkError) {
    if (createdAuthUser) {
      await admin.auth.admin.deleteUser(userId)
    }
    return { error: linkError.message }
  }

  deps.revalidate(clienteId)

  return {
    error: null,
    success: true,
    userId,
    contactoId,
    createdAuthUser,
    inviteQueued: Boolean(input.queueInvite),
  }
}

/**
 * Genera magiclink de acceso solo para un contacto Media ya vinculado.
 * Server-only: no acepta email arbitrario ni roles distintos de media_contacto.
 * No envía correo; el action_link solo vuelve en la respuesta al admin.
 */
export const runGenerateMediaContactoAccessLink = async (
  deps: CreateMediaContactoDeps,
  input: { clienteId: string; contactoId: string },
): Promise<MediaContactoAccessState> => {
  const auth = await deps.requireAdmin()
  const forbidden = messageIfCannotCreateUsuario(auth.rol)
  if (forbidden) return { error: forbidden }

  const ready = deps.isReady ? deps.isReady() : MEDIA_EMPRESA_CONTACTOS_READY
  if (!ready) {
    return { error: "Flujo media_contacto no activado." }
  }

  const clienteId = input.clienteId.trim()
  const contactoId = input.contactoId.trim()
  if (!clienteId || !contactoId) {
    return { error: "clienteId y contactoId son requeridos." }
  }

  const redirectTo = deps.getAccessLinkRedirectTo?.().trim() ?? ""
  if (!redirectTo || !/^https?:\/\//i.test(redirectTo)) {
    return {
      error:
        "No hay URL de retorno configurada para el enlace (origen del portal).",
    }
  }

  const admin = deps.getAdmin()
  const { data: contacto, error } = await admin
    .from("media_cliente_contactos")
    .select("id, auth_user_id, activo, email")
    .eq("id", contactoId)
    .eq("cliente_id", clienteId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!contacto || contacto.activo === false) {
    return { error: "Contacto no encontrado." }
  }

  const authUserId = (contacto.auth_user_id as string | null)?.trim() ?? ""
  if (!authUserId) {
    return { error: "Vincula o crea el acceso antes de generar el enlace." }
  }

  const { data: profile, error: profileError } = await admin
    .from("sponsor_usuarios")
    .select("id, rol, activo")
    .eq("id", authUserId)
    .maybeSingle()

  if (profileError) return { error: profileError.message }
  if (!profile || profile.activo === false) {
    return { error: "El usuario vinculado no está activo." }
  }
  if (profile.rol !== "media_contacto") {
    return {
      error:
        "Solo se genera enlace para contactos Media. No aplica a otros roles.",
    }
  }

  const { data: authUser, error: authUserError } =
    await admin.auth.admin.getUserById(authUserId)
  if (authUserError) return { error: authUserError.message }

  const email = (authUser.user?.email ?? "").trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "El usuario vinculado no tiene un email Auth válido." }
  }

  const contactoEmail = ((contacto.email as string | null) ?? "")
    .trim()
    .toLowerCase()
  if (contactoEmail && contactoEmail !== email) {
    return {
      error:
        "El email del contacto no coincide con el usuario Auth vinculado.",
    }
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    })

  if (linkError) return { error: linkError.message }

  const actionLink = linkData.properties?.action_link
  if (typeof actionLink !== "string" || actionLink.length === 0) {
    return { error: "Auth no devolvió un enlace de acceso." }
  }

  return {
    error: null,
    success: true,
    userId: authUserId,
    contactoId,
    accessLink: actionLink,
    accessLinkExpiryHint:
      deps.getAccessLinkExpiryHint?.() ??
      DEFAULT_MEDIA_ACCESS_LINK_EXPIRY_HINT,
  }
}

