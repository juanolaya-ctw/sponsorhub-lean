import {
  SPONSOR_NOT_IN_EVENTO,
  messageIfCannotCreateUsuario,
  messageIfSponsorOutsideEvento,
} from "@/lib/admin/create-usuario-guards"

export type UsuarioActionState = {
  error: string | null
  success?: boolean
}

export type CreateUsuarioAdmin = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{
          data: { id: string; evento_id: string | null } | null
          error: { message: string } | null
        }>
      }
    }
    insert: (row: Record<string, unknown>) => Promise<{
      error: { message: string } | null
    }>
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
    }
  }
}

export type CreateUsuarioDeps = {
  /** Debe resolver solo para admin_ct; en producción usa requireAdmin(). */
  requireAdmin: () => Promise<{ rol: string }>
  getAdmin: () => CreateUsuarioAdmin
  revalidateUsuarios: (slug: string) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const optionalText = (value: FormDataEntryValue | null): string | null => {
  const trimmed = String(value ?? "").trim()
  return trimmed.length > 0 ? trimmed : null
}

const assertSponsorInEvento = async (
  admin: CreateUsuarioAdmin,
  sponsorId: string,
  eventoId: string,
): Promise<string | null> => {
  const { data, error } = await admin
    .from("sponsors")
    .select("id, evento_id")
    .eq("id", sponsorId)
    .maybeSingle()

  if (error) return error.message
  if (!data) return SPONSOR_NOT_IN_EVENTO
  return messageIfSponsorOutsideEvento(data.evento_id, eventoId)
}

/**
 * Núcleo de createUsuario (inyectable). No crea usuarios reales en tests:
 * los deps mockean Auth/DB. Conserva la misma autorización y checks de sponsor.
 */
export const runCreateUsuario = async (
  deps: CreateUsuarioDeps,
  formData: FormData,
): Promise<UsuarioActionState> => {
  const auth = await deps.requireAdmin()
  const forbidden = messageIfCannotCreateUsuario(auth.rol)
  if (forbidden) return { error: forbidden }

  const admin = deps.getAdmin()

  const slug = String(formData.get("slug") ?? "").trim()
  const eventoId = String(formData.get("evento_id") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const passwordConfirm = String(formData.get("password_confirm") ?? "")
  const sponsorId = String(formData.get("sponsor_id") ?? "").trim()
  const nombre = optionalText(formData.get("nombre"))
  const cargo = optionalText(formData.get("cargo"))
  const telefono = optionalText(formData.get("telefono"))
  const notas = optionalText(formData.get("notas"))

  if (!slug || !eventoId) {
    return { error: "Falta el evento." }
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "El email no es válido." }
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." }
  }
  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." }
  }
  if (!sponsorId) {
    return { error: "Debes vincular un sponsor." }
  }

  const sponsorError = await assertSponsorInEvento(admin, sponsorId, eventoId)
  if (sponsorError) return { error: sponsorError }

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

  const userId = authData.user.id
  const { error: insertError } = await admin.from("sponsor_usuarios").insert({
    id: userId,
    sponsor_id: sponsorId,
    rol: "sponsor",
    activo: true,
    nombre,
    cargo,
    telefono,
    notas,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: insertError.message }
  }

  deps.revalidateUsuarios(slug)
  return { error: null, success: true }
}
