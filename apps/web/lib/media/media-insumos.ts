/**
 * Carga de insumos por pieza Media.
 * Interpretación: entrega de archivos (como insumos de beneficios),
 * SIN aprobar / publicar / cambiar estado del asset automáticamente.
 */

import {
  MEDIA_EMPRESA_CONTACTOS_READY,
  assertAssetBelongsToCliente,
  assertClienteAuthorized,
  assertMediaContactoCannotEscalate,
  assertMediaContactoProfile,
  assertMediaInsumoPath,
  buildMediaInsumoStoragePath,
  parseMediaInsumoStoragePath,
  resolveAuthorizedClienteIds,
  type AssetClienteOwnership,
  type MediaContactoAuthProfile,
  type MediaContactoLink,
} from "@/lib/media/media-contacto-auth"

export const MEDIA_INSUMOS_BUCKET = "sponsorhub-archivos"

export type MediaInsumoRow = {
  id: string
  assetEjecutadoId: string
  clienteId: string
  contactoId: string | null
  nombreArchivo: string
  storagePath: string
  subidoPor: string | null
  createdAt: string
}

export type UploadInsumoInput = {
  profile: MediaContactoAuthProfile
  links: MediaContactoLink[]
  ownership: AssetClienteOwnership | null
  clienteId: string
  assetEjecutadoId: string
  filename: string
  uuid: string
}

export type UploadInsumoPlan =
  | {
      ok: true
      storagePath: string
      clienteId: string
      assetEjecutadoId: string
      contactoId: string
      insert: {
        asset_ejecutado_id: string
        cliente_id: string
        contacto_id: string
        nombre_archivo: string
        storage_path: string
        subido_por: string
      }
      /** Explícito: no tocar estado del asset. */
      mustNotChangeAssetEstado: true
    }
  | { ok: false; error: string }

/** Autorización de upload (testeable sin flip del flag de activación). */
export const authorizeUploadMediaInsumo = (
  input: UploadInsumoInput,
): UploadInsumoPlan => {
  const profileCheck = assertMediaContactoProfile(input.profile)
  if (!profileCheck.ok) return profileCheck

  const authorized = resolveAuthorizedClienteIds(
    input.links,
    input.profile.userId,
  )
  const clienteCheck = assertClienteAuthorized(authorized, input.clienteId)
  if (!clienteCheck.ok) return clienteCheck

  const assetCheck = assertAssetBelongsToCliente(
    input.ownership,
    input.clienteId,
  )
  if (!assetCheck.ok) return assetCheck

  if (input.ownership!.assetEjecutadoId !== input.assetEjecutadoId) {
    return { ok: false, error: "Identificador de pieza inconsistente." }
  }

  const link = input.links.find(
    (l) =>
      l.activo &&
      l.authUserId === input.profile.userId &&
      l.clienteId === input.clienteId,
  )
  if (!link) {
    return { ok: false, error: "Contacto no vinculado a esta empresa." }
  }

  const storagePath = buildMediaInsumoStoragePath({
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
    uuid: input.uuid,
    filename: input.filename,
  })
  const pathCheck = assertMediaInsumoPath({
    storagePath,
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
  })
  if (!pathCheck.ok) return pathCheck

  return {
    ok: true,
    storagePath,
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
    contactoId: link.contactoId,
    insert: {
      asset_ejecutado_id: input.assetEjecutadoId,
      cliente_id: input.clienteId,
      contacto_id: link.contactoId,
      nombre_archivo: input.filename,
      storage_path: storagePath,
      subido_por: input.profile.userId,
    },
    mustNotChangeAssetEstado: true,
  }
}

export const planUploadMediaInsumo = (
  input: UploadInsumoInput,
): UploadInsumoPlan => {
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return {
      ok: false,
      error:
        "El flujo de contactos/insumos Media aún no está activado (migración pendiente).",
    }
  }
  return authorizeUploadMediaInsumo(input)
}

export type DownloadInsumoInput = {
  profile: MediaContactoAuthProfile
  links: MediaContactoLink[]
  insumo: MediaInsumoRow | null
  /** Si el caller intenta forzar otro cliente/path */
  claimedClienteId?: string
  claimedPath?: string
}

export const authorizeDownloadMediaInsumo = (
  input: DownloadInsumoInput,
):
  | { ok: true; storagePath: string; clienteId: string }
  | { ok: false; error: string } => {
  const profileCheck = assertMediaContactoProfile(input.profile)
  if (!profileCheck.ok) return profileCheck

  if (!input.insumo) return { ok: false, error: "Archivo no encontrado." }

  const authorized = resolveAuthorizedClienteIds(
    input.links,
    input.profile.userId,
  )
  const clienteCheck = assertClienteAuthorized(
    authorized,
    input.insumo.clienteId,
  )
  if (!clienteCheck.ok) return clienteCheck

  if (
    input.claimedClienteId &&
    input.claimedClienteId !== input.insumo.clienteId
  ) {
    return { ok: false, error: "No autorizado para esta empresa." }
  }

  if (input.claimedPath && input.claimedPath !== input.insumo.storagePath) {
    return { ok: false, error: "Ruta de archivo no autorizada." }
  }

  const parsed = parseMediaInsumoStoragePath(input.insumo.storagePath)
  if (!parsed || parsed.clienteId !== input.insumo.clienteId) {
    return { ok: false, error: "Ruta de almacenamiento inválida." }
  }

  return {
    ok: true,
    storagePath: input.insumo.storagePath,
    clienteId: input.insumo.clienteId,
  }
}

export const planDownloadMediaInsumo = (
  input: DownloadInsumoInput,
):
  | { ok: true; storagePath: string; clienteId: string }
  | { ok: false; error: string } => {
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { ok: false, error: "Flujo de insumos Media no activado." }
  }
  return authorizeDownloadMediaInsumo(input)
}

/** Rechazo explícito de escalada (para tests y actions). */
export const rejectMediaContactoPrivilege = (
  action:
    | "cambiar_creditos"
    | "cambiar_contrato"
    | "cambiar_estado_asset"
    | "aprobar_asset"
    | "gestionar_permisos"
    | "vincular_acceso",
) => assertMediaContactoCannotEscalate(action)
