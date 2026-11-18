"use server"

import { revalidatePath } from "next/cache"
import { requireMediaContacto, getAuthContext } from "@/lib/auth/require-admin"
import {
  MEDIA_EMPRESA_CONTACTOS_READY,
  assertMediaInsumoPath,
  type AssetClienteOwnership,
  type MediaContactoLink,
} from "@/lib/media/media-contacto-auth"
import {
  MEDIA_INSUMOS_BUCKET,
  planDownloadMediaInsumo,
  planUploadMediaInsumo,
  rejectMediaContactoPrivilege,
  type MediaInsumoRow,
} from "@/lib/media/media-insumos"
import {
  assertMarcaPath,
  authorizeDownloadMarcaContacto,
  authorizeUploadMarcaContacto,
  isMissingTableError,
} from "@/lib/media/insumos-marca"
import { createAdminClient } from "@/lib/supabase/admin"

export type ContactoInsumoActionState = {
  error: string | null
  success?: boolean
  storagePath?: string
  signedUrl?: string
}

const loadLinksForUser = async (
  userId: string,
): Promise<MediaContactoLink[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("media_cliente_contactos")
    .select("id, cliente_id, auth_user_id, activo")
    .eq("auth_user_id", userId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    contactoId: r.id as string,
    clienteId: r.cliente_id as string,
    authUserId: (r.auth_user_id as string | null) ?? null,
    activo: r.activo === true,
  }))
}

const loadOwnership = async (
  assetEjecutadoId: string,
): Promise<AssetClienteOwnership | null> => {
  const admin = createAdminClient()
  const { data: asset, error } = await admin
    .from("media_assets_ejecutados")
    .select("id, billing_cycle_id")
    .eq("id", assetEjecutadoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!asset) return null

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, cliente_id")
    .eq("id", asset.billing_cycle_id as string)
    .maybeSingle()
  if (cycleError) throw new Error(cycleError.message)

  return {
    assetEjecutadoId: asset.id as string,
    billingCycleId: asset.billing_cycle_id as string,
    clienteId: (cycle?.cliente_id as string | null) ?? null,
  }
}

/**
 * Insumo de una pieza: mismo flujo que eventos (prepare → uploadToSignedUrl
 * desde el navegador → finalize), sin pasar el archivo por la server action
 * (límite de 1 MB). No cambia el estado del asset (diferencia vs
 * aprobarAsset / actualizarEstadoAsset). Path media-cliente/{cliente}/{asset}/...
 * con asserts de servidor en ambos pasos.
 */
export async function prepararSubidaInsumoPieza(input: {
  clienteId: string
  assetEjecutadoId: string
  filename: string
}): Promise<{ data: { path: string; token: string } | null; error: string | null }> {
  const { user } = await requireMediaContacto()
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { data: null, error: "Flujo de insumos Media no activado." }
  }

  // Ignorar cualquier clienteId distinto al autorizado (no confiar en el browser)
  const links = await loadLinksForUser(user.id)
  const ownership = await loadOwnership(input.assetEjecutadoId)
  const plan = planUploadMediaInsumo({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    ownership,
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
    filename: input.filename,
    uuid: crypto.randomUUID(),
  })
  if (!plan.ok) return { data: null, error: plan.error }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(MEDIA_INSUMOS_BUCKET)
    .createSignedUploadUrl(plan.storagePath)
  if (error) return { data: null, error: error.message }
  return { data: { path: data.path, token: data.token }, error: null }
}

export async function finalizarSubidaInsumoPieza(input: {
  clienteId: string
  assetEjecutadoId: string
  storagePath: string
  filename: string
}): Promise<ContactoInsumoActionState> {
  const { user } = await requireMediaContacto()
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de insumos Media no activado." }
  }

  // Re-autoriza y exige el path canónico de esa empresa y pieza.
  const links = await loadLinksForUser(user.id)
  const ownership = await loadOwnership(input.assetEjecutadoId)
  const plan = planUploadMediaInsumo({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    ownership,
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
    filename: input.filename,
    uuid: "check",
  })
  if (!plan.ok) return { error: plan.error }
  const pathCheck = assertMediaInsumoPath({
    storagePath: input.storagePath,
    clienteId: input.clienteId,
    assetEjecutadoId: input.assetEjecutadoId,
  })
  if (!pathCheck.ok) return { error: pathCheck.error }

  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from("media_asset_insumos")
    .insert({ ...plan.insert, storage_path: input.storagePath })
  if (insertError) {
    await admin.storage.from(MEDIA_INSUMOS_BUCKET).remove([input.storagePath])
    return { error: insertError.message }
  }

  // mustNotChangeAssetEstado: no UPDATE a media_assets_ejecutados.estado
  revalidatePath("/portal/media")
  return { error: null, success: true, storagePath: input.storagePath }
}

export async function firmarDescargaInsumoMediaContacto(input: {
  insumoId: string
  /** Intentos de spoofing se rechazan */
  claimedClienteId?: string
  claimedPath?: string
}): Promise<ContactoInsumoActionState> {
  const { user } = await requireMediaContacto()

  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de insumos Media no activado." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("media_asset_insumos")
    .select(
      "id, asset_ejecutado_id, cliente_id, contacto_id, nombre_archivo, storage_path, subido_por, created_at",
    )
    .eq("id", input.insumoId)
    .maybeSingle()

  if (error) return { error: error.message }

  const insumo: MediaInsumoRow | null = data
    ? {
        id: data.id as string,
        assetEjecutadoId: data.asset_ejecutado_id as string,
        clienteId: data.cliente_id as string,
        contactoId: (data.contacto_id as string | null) ?? null,
        nombreArchivo: data.nombre_archivo as string,
        storagePath: data.storage_path as string,
        subidoPor: (data.subido_por as string | null) ?? null,
        createdAt: data.created_at as string,
      }
    : null

  const links = await loadLinksForUser(user.id)
  const plan = planDownloadMediaInsumo({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    insumo,
    claimedClienteId: input.claimedClienteId,
    claimedPath: input.claimedPath,
  })
  if (!plan.ok) return { error: plan.error }

  const { data: signed, error: signError } = await admin.storage
    .from(MEDIA_INSUMOS_BUCKET)
    .createSignedUrl(plan.storagePath, 60, {
      download: insumo?.nombreArchivo,
    })

  if (signError || !signed?.signedUrl) {
    return { error: signError?.message ?? "No se pudo firmar la URL." }
  }

  return {
    error: null,
    success: true,
    signedUrl: signed.signedUrl,
    storagePath: plan.storagePath,
  }
}

/**
 * Insumos de marca (empresa): mismo flujo que eventos
 * (prepare → uploadToSignedUrl desde el navegador → finalize), así el archivo
 * no pasa por el límite de tamaño de las server actions.
 * Queda "Cargado" en todas las piezas que lo piden. No cambia estados ni créditos.
 */
export async function prepararSubidaMarcaContacto(input: {
  clienteId: string
  tipo: string
  filename: string
}): Promise<{ data: { path: string; token: string } | null; error: string | null }> {
  const { user } = await requireMediaContacto()
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { data: null, error: "Flujo de insumos Media no activado." }
  }
  const links = await loadLinksForUser(user.id)
  const plan = authorizeUploadMarcaContacto({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    clienteId: input.clienteId,
    tipo: input.tipo,
    filename: input.filename,
    uuid: crypto.randomUUID(),
  })
  if (!plan.ok) return { data: null, error: plan.error }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(MEDIA_INSUMOS_BUCKET)
    .createSignedUploadUrl(plan.storagePath)
  if (error) return { data: null, error: error.message }
  return { data: { path: data.path, token: data.token }, error: null }
}

export async function finalizarSubidaMarcaContacto(input: {
  clienteId: string
  tipo: string
  storagePath: string
  filename: string
}): Promise<ContactoInsumoActionState> {
  const { user } = await requireMediaContacto()
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de insumos Media no activado." }
  }
  const links = await loadLinksForUser(user.id)
  // Re-autoriza (no confiar en el navegador) y exige el path canónico.
  const plan = authorizeUploadMarcaContacto({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    clienteId: input.clienteId,
    tipo: input.tipo,
    filename: input.filename,
    uuid: "check",
  })
  if (!plan.ok) return { error: plan.error }
  const pathCheck = assertMarcaPath({
    storagePath: input.storagePath,
    clienteId: input.clienteId,
    tipo: input.tipo,
  })
  if (!pathCheck.ok) return { error: pathCheck.error }

  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from("media_cliente_insumos_marca")
    .insert({ ...plan.insert, storage_path: input.storagePath })
  if (insertError) {
    await admin.storage.from(MEDIA_INSUMOS_BUCKET).remove([input.storagePath])
    if (isMissingTableError(insertError)) {
      return { error: "Los archivos de marca aún no están activos." }
    }
    return { error: insertError.message }
  }

  revalidatePath("/portal/media")
  return { error: null, success: true, storagePath: input.storagePath }
}

export async function firmarDescargaInsumoMarcaContacto(input: {
  archivoId: string
}): Promise<ContactoInsumoActionState> {
  const { user } = await requireMediaContacto()
  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de insumos Media no activado." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("media_cliente_insumos_marca")
    .select("id, cliente_id, nombre_archivo, storage_path")
    .eq("id", input.archivoId)
    .maybeSingle()
  if (error) return { error: error.message }

  const links = await loadLinksForUser(user.id)
  const plan = authorizeDownloadMarcaContacto({
    profile: { userId: user.id, rol: "media_contacto", activo: true },
    links,
    archivo: data
      ? {
          clienteId: data.cliente_id as string,
          storagePath: data.storage_path as string,
        }
      : null,
  })
  if (!plan.ok) return { error: plan.error }

  const { data: signed, error: signError } = await admin.storage
    .from(MEDIA_INSUMOS_BUCKET)
    .createSignedUrl(plan.storagePath, 60, {
      download: (data?.nombre_archivo as string | undefined) ?? undefined,
    })
  if (signError || !signed?.signedUrl) {
    return { error: signError?.message ?? "No se pudo firmar la URL." }
  }
  return { error: null, success: true, signedUrl: signed.signedUrl }
}

/** Cualquier intento de escalada desde el portal contacto. */
export async function rechazoPrivilegioMediaContacto(
  action:
    | "cambiar_creditos"
    | "cambiar_contrato"
    | "cambiar_estado_asset"
    | "aprobar_asset"
    | "gestionar_permisos"
    | "vincular_acceso",
): Promise<ContactoInsumoActionState> {
  const ctx = await getAuthContext()
  if (ctx.rol !== "media_contacto") {
    return { error: "Solo aplica a media_contacto." }
  }
  const rejected = rejectMediaContactoPrivilege(action)
  return { error: rejected.error }
}
