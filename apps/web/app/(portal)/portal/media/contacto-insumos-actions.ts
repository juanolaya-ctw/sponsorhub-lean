"use server"

import { revalidatePath } from "next/cache"
import { requireMediaContacto, getAuthContext } from "@/lib/auth/require-admin"
import {
  MEDIA_EMPRESA_CONTACTOS_READY,
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
 * Sube un insumo para una pieza. No cambia estado del asset
 * (diferencia vs aprobarAsset / actualizarEstadoAsset).
 * Reutiliza el patrón de entrega de archivos de beneficios, con path
 * media-cliente/{cliente}/{asset}/... y asserts de servidor.
 */
export async function subirInsumoMediaContacto(input: {
  clienteId: string
  assetEjecutadoId: string
  filename: string
  contentType: string
  bytesBase64: string
}): Promise<ContactoInsumoActionState> {
  const { user } = await requireMediaContacto()

  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de insumos Media no activado." }
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
  if (!plan.ok) return { error: plan.error }

  const binary = Buffer.from(input.bytesBase64, "base64")
  if (binary.length === 0) return { error: "Archivo vacío." }
  if (binary.length > 15 * 1024 * 1024) {
    return { error: "Archivo demasiado grande (máx. 15 MB)." }
  }

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(MEDIA_INSUMOS_BUCKET)
    .upload(plan.storagePath, binary, {
      contentType: input.contentType || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) return { error: uploadError.message }

  const { error: insertError } = await admin
    .from("media_asset_insumos")
    .insert(plan.insert)

  if (insertError) {
    await admin.storage.from(MEDIA_INSUMOS_BUCKET).remove([plan.storagePath])
    return { error: insertError.message }
  }

  // mustNotChangeAssetEstado: no UPDATE a media_assets_ejecutados.estado
  revalidatePath("/portal/media")
  return { error: null, success: true, storagePath: plan.storagePath }
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
