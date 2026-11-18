/**
 * Autorización Media contacto ↔ empresa ↔ pieza.
 * Puro / testeable. El vínculo lo establece un admin; nunca query params.
 *
 * MEDIA_EMPRESA_CONTACTOS_READY=true tras aplicar 0024 en remoto.
 * (esquema vigente sigue operativo).
 */

export const MEDIA_INSUMOS_STORAGE_PREFIX = "media-cliente"

/** Activar solo tras aplicar 0024 y OK de ejecución. */
export const MEDIA_EMPRESA_CONTACTOS_READY = true

export type MediaContactoAuthProfile = {
  userId: string
  rol: string
  activo: boolean
}

export type MediaContactoLink = {
  contactoId: string
  clienteId: string
  authUserId: string | null
  activo: boolean
}

export type AssetClienteOwnership = {
  assetEjecutadoId: string
  clienteId: string | null
  billingCycleId: string
}

export const isMediaContactoRole = (rol: string | null | undefined): boolean =>
  rol === "media_contacto"

export const assertMediaContactoProfile = (
  profile: MediaContactoAuthProfile | null,
): { ok: true } | { ok: false; error: string } => {
  if (!profile) return { ok: false, error: "No autorizado." }
  if (!profile.activo) return { ok: false, error: "Cuenta desactivada." }
  if (!isMediaContactoRole(profile.rol)) {
    return { ok: false, error: "Se requiere rol media_contacto." }
  }
  return { ok: true }
}

/** Empresas autorizadas: solo vía vínculos admin (contacto.auth_user_id). */
export const resolveAuthorizedClienteIds = (
  links: MediaContactoLink[],
  userId: string,
): string[] => {
  const ids = new Set<string>()
  for (const link of links) {
    if (!link.activo) continue
    if (link.authUserId !== userId) continue
    ids.add(link.clienteId)
  }
  return [...ids]
}

export const assertClienteAuthorized = (
  authorizedClienteIds: readonly string[],
  clienteId: string,
): { ok: true } | { ok: false; error: string } => {
  if (!authorizedClienteIds.includes(clienteId)) {
    return {
      ok: false,
      error: "No autorizado para esta empresa.",
    }
  }
  return { ok: true }
}

export const assertAssetBelongsToCliente = (
  ownership: AssetClienteOwnership | null,
  clienteId: string,
): { ok: true } | { ok: false; error: string } => {
  if (!ownership) return { ok: false, error: "Pieza no encontrada." }
  if (ownership.clienteId !== clienteId) {
    return { ok: false, error: "La pieza no pertenece a esta empresa." }
  }
  return { ok: true }
}

export const safeMediaFilename = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")

/**
 * Path canónico. Cambiar clienteId/assetId en la URL no basta:
 * el servidor debe validar con assertMediaInsumoPath + ownership.
 */
export const buildMediaInsumoStoragePath = (input: {
  clienteId: string
  assetEjecutadoId: string
  uuid: string
  filename: string
}): string => {
  const safe = safeMediaFilename(input.filename)
  return `${MEDIA_INSUMOS_STORAGE_PREFIX}/${input.clienteId}/${input.assetEjecutadoId}/${input.uuid}-${safe}`
}

export const parseMediaInsumoStoragePath = (
  path: string,
): {
  clienteId: string
  assetEjecutadoId: string
} | null => {
  const parts = path.split("/")
  if (parts.length < 4) return null
  if (parts[0] !== MEDIA_INSUMOS_STORAGE_PREFIX) return null
  const clienteId = parts[1]
  const assetEjecutadoId = parts[2]
  if (!clienteId || !assetEjecutadoId) return null
  return { clienteId, assetEjecutadoId }
}

export const assertMediaInsumoPath = (input: {
  storagePath: string
  clienteId: string
  assetEjecutadoId: string
}): { ok: true } | { ok: false; error: string } => {
  const parsed = parseMediaInsumoStoragePath(input.storagePath)
  if (!parsed) {
    return { ok: false, error: "Ruta de almacenamiento inválida." }
  }
  if (parsed.clienteId !== input.clienteId) {
    return { ok: false, error: "La ruta no corresponde a la empresa." }
  }
  if (parsed.assetEjecutadoId !== input.assetEjecutadoId) {
    return { ok: false, error: "La ruta no corresponde a la pieza." }
  }
  return { ok: true }
}

/** Contactos no pueden cambiar créditos, contratos, estados ni permisos. */
export const MEDIA_CONTACTO_FORBIDDEN_ACTIONS = [
  "cambiar_creditos",
  "cambiar_contrato",
  "cambiar_estado_asset",
  "aprobar_asset",
  "gestionar_permisos",
  "vincular_acceso",
] as const

export type MediaContactoForbiddenAction =
  (typeof MEDIA_CONTACTO_FORBIDDEN_ACTIONS)[number]

export const assertMediaContactoCannotEscalate = (
  action: MediaContactoForbiddenAction,
): { ok: false; error: string } => ({
  ok: false,
  error: `Acción no permitida para contacto Media: ${action}.`,
})

/**
 * Vincular acceso: solo admin. Rechaza si el usuario ya es sponsor/admin_ct
 * (no romper usuarios actuales) o si el rol no es media_contacto.
 */
export const assertCanLinkAuthUserToContacto = (input: {
  actorRol: string
  targetUser: { id: string; rol: string; sponsor_id: string | null } | null
}): { ok: true } | { ok: false; error: string } => {
  if (input.actorRol !== "admin_ct") {
    return { ok: false, error: "Solo un admin puede vincular acceso." }
  }
  if (!input.targetUser) {
    return {
      ok: false,
      error:
        "Usuario no encontrado en sponsor_usuarios con rol media_contacto.",
    }
  }
  if (input.targetUser.rol === "admin_ct" || input.targetUser.rol === "sponsor") {
    return {
      ok: false,
      error:
        "No se puede reasignar un usuario admin_ct o sponsor a contacto Media.",
    }
  }
  if (input.targetUser.rol !== "media_contacto") {
    return {
      ok: false,
      error: "El usuario debe tener rol media_contacto (sponsor_id NULL).",
    }
  }
  if (input.targetUser.sponsor_id !== null) {
    return {
      ok: false,
      error: "media_contacto no debe tener sponsor_id.",
    }
  }
  return { ok: true }
}
