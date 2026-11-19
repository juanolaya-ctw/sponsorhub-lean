"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/require-admin"
import {
  DEFAULT_MEDIA_ACCESS_LINK_EXPIRY_HINT,
  runCreateOrLinkMediaContacto,
  runGenerateMediaContactoAccessLink,
  runSetMediaContactoPassword,
  type MediaContactoAccessState,
} from "@/lib/admin/create-media-contacto-core"
import {
  MEDIA_CONTACTOS_TABLE_READY,
  emptyContacto,
  planPersistEmpresaContactos,
  type ContactoDraft,
} from "@/lib/media/empresa-contactos"
import { MEDIA_EMPRESA_CONTACTOS_READY } from "@/lib/media/media-contacto-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { generarPasswordSegura } from "@/lib/auth/password"

export type ContactosActionState = {
  error: string | null
  success?: boolean
  userId?: string
  /** Solo en memoria para el admin que generó el enlace; no persistir. */
  accessLink?: string
  accessLinkExpiryHint?: string
  /** Solo en memoria para el admin; se muestra una vez y no se persiste. */
  generatedPassword?: string
  accessEmail?: string
}

const resolveAccessLinkRedirectTo = (): string => {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  if (configured) {
    return `${configured.replace(/\/$/, "")}/portal/media`
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000/portal/media"
  }
  return ""
}

const revalidateCliente = (clienteId: string) => {
  revalidatePath("/admin/media")
  revalidatePath(`/admin/media/${clienteId}`)
}

const mediaContactoDeps = () => ({
  requireAdmin: async () => {
    const ctx = await requireAdmin()
    return { rol: ctx.rol }
  },
  getAdmin: () => createAdminClient() as never,
  isReady: () => MEDIA_EMPRESA_CONTACTOS_READY,
  revalidate: revalidateCliente,
})

/**
 * Guarda N contactos de una empresa.
 * READY=false: solo permite 0–1 vía legacy (bloquea pérdida).
 * READY=true: escribe media_cliente_contactos sin concatenar/descartar.
 */
export async function guardarContactosEmpresa(
  clienteId: string,
  empresaNombre: string,
  contactos: ContactoDraft[],
  filaEmail?: string | null,
  filaTelefono?: string | null,
): Promise<ContactosActionState> {
  await requireAdmin()
  const admin = createAdminClient()

  const plan = planPersistEmpresaContactos({
    empresaNombre,
    contactos,
    filaEmail,
    filaTelefono,
  })
  if (!plan.ok) return { error: plan.error }

  // En mode=table la etiqueta CRM (nombre) se conserva: no se pisa con empresa.
  const empresaPatch =
    plan.mode === "table"
      ? {
          empresa: plan.legacy.empresa,
          email_contacto: plan.legacy.email_contacto,
          telefono: plan.legacy.telefono,
        }
      : {
          nombre: plan.legacy.nombre,
          empresa: plan.legacy.empresa,
          email_contacto: plan.legacy.email_contacto,
          telefono: plan.legacy.telefono,
        }

  const { error: empresaError } = await admin
    .from("media_clientes")
    .update(empresaPatch)
    .eq("id", clienteId)

  if (empresaError) return { error: empresaError.message }

  if (plan.mode === "legacy" || !MEDIA_CONTACTOS_TABLE_READY) {
    revalidateCliente(clienteId)
    return { error: null, success: true }
  }

  const { data: existing, error: listError } = await admin
    .from("media_cliente_contactos")
    .select("id")
    .eq("cliente_id", clienteId)

  if (listError) return { error: listError.message }

  const keepIds = new Set(
    plan.contactos.map((c) => c.id).filter((id): id is string => Boolean(id)),
  )

  for (const row of existing ?? []) {
    const id = row.id as string
    if (!keepIds.has(id)) {
      const { error } = await admin
        .from("media_cliente_contactos")
        .update({ activo: false })
        .eq("id", id)
        .eq("cliente_id", clienteId)
      if (error) return { error: error.message }
    }
  }

  for (const c of plan.contactos) {
    if (c.id) {
      const { error } = await admin
        .from("media_cliente_contactos")
        .update({
          nombre: c.nombre,
          email: c.email || null,
          telefono: c.telefono || null,
          cargo: c.cargo || null,
          activo: true,
        })
        .eq("id", c.id)
        .eq("cliente_id", clienteId)
      if (error) return { error: error.message }
    } else {
      const { error } = await admin.from("media_cliente_contactos").insert({
        cliente_id: clienteId,
        nombre: c.nombre,
        email: c.email || null,
        telefono: c.telefono || null,
        cargo: c.cargo || null,
        activo: true,
      })
      if (error) return { error: error.message }
    }
  }

  revalidateCliente(clienteId)
  return { error: null, success: true }
}

/** Crear usuario media_contacto y vincularlo al contacto (sin enviar invitación). */
export async function crearAccesoMediaContacto(input: {
  clienteId: string
  contactoId: string
  email: string
  password: string
  passwordConfirm: string
  nombre?: string
  cargo?: string
  telefono?: string
}): Promise<ContactosActionState> {
  const result = await runCreateOrLinkMediaContacto(mediaContactoDeps(), {
    ...input,
    mode: "create",
    queueInvite: false,
  })
  return toActionState(result)
}

/** Vincular usuario media_contacto existente por email exacto. */
export async function vincularAccesoMediaContacto(input: {
  clienteId: string
  contactoId: string
  email: string
}): Promise<ContactosActionState> {
  const result = await runCreateOrLinkMediaContacto(mediaContactoDeps(), {
    ...input,
    mode: "link",
    queueInvite: false,
  })
  return toActionState(result)
}

/**
 * Genera magiclink de acceso para un contacto Media vinculado.
 * Solo admin; email sale del Auth del vínculo (no del formulario).
 * No envía correo; el enlace solo vuelve en esta respuesta.
 */
export async function generarEnlaceAccesoMediaContacto(input: {
  clienteId: string
  contactoId: string
}): Promise<ContactosActionState> {
  const result = await runGenerateMediaContactoAccessLink(
    {
      ...mediaContactoDeps(),
      getAccessLinkRedirectTo: resolveAccessLinkRedirectTo,
      getAccessLinkExpiryHint: () => DEFAULT_MEDIA_ACCESS_LINK_EXPIRY_HINT,
    },
    input,
  )
  return toActionState(result)
}

/**
 * Asigna una contraseña nueva (generada en servidor si no se envía) a un
 * contacto Media ya vinculado. Flujo principal de acceso: email + contraseña.
 * No envía correo; la contraseña vuelve una sola vez al admin.
 */
export async function asignarPasswordMediaContacto(input: {
  clienteId: string
  contactoId: string
  password?: string
}): Promise<ContactosActionState> {
  const password = input.password?.trim() ? input.password : generarPasswordSegura()
  const result = await runSetMediaContactoPassword(mediaContactoDeps(), {
    clienteId: input.clienteId,
    contactoId: input.contactoId,
    password,
  })
  if (result.error) return { error: result.error }
  return {
    error: null,
    success: true,
    userId: result.userId,
    generatedPassword: password,
    accessEmail: result.email,
  }
}

export async function desvincularAccesoContacto(
  clienteId: string,
  contactoId: string,
): Promise<ContactosActionState> {
  await requireAdmin()

  if (!MEDIA_EMPRESA_CONTACTOS_READY) {
    return { error: "Flujo de contactos no activado." }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("media_cliente_contactos")
    .update({ auth_user_id: null })
    .eq("id", contactoId)
    .eq("cliente_id", clienteId)

  if (error) return { error: error.message }

  revalidateCliente(clienteId)
  return { error: null, success: true }
}

/** @deprecated usar vincularAccesoMediaContacto por email */
export async function vincularAccesoContacto(
  clienteId: string,
  contactoId: string,
  _authUserId: string,
): Promise<ContactosActionState> {
  await requireAdmin()
  return {
    error:
      "Usa crear/vincular por email (crearAccesoMediaContacto / vincularAccesoMediaContacto). No se acepta pegar auth_user_id.",
  }
}

export async function nuevoContactoDraft(): Promise<ContactoDraft> {
  await requireAdmin()
  return emptyContacto()
}

const toActionState = (
  result: MediaContactoAccessState,
): ContactosActionState => ({
  error: result.error,
  success: result.success,
  userId: result.userId,
  accessLink: result.accessLink,
  accessLinkExpiryHint: result.accessLinkExpiryHint,
})
