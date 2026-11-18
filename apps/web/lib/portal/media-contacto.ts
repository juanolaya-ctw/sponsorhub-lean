import { cache } from "react"
import { requireMediaContacto } from "@/lib/auth/require-admin"
import { MEDIA_EMPRESA_CONTACTOS_READY } from "@/lib/media/media-contacto-auth"
import {
  contactosFromTableRows,
  type ContactoTableRow,
} from "@/lib/media/empresa-contactos"
import { createAdminClient } from "@/lib/supabase/admin"

export type MediaContactoContext = {
  userId: string
  contactoId: string
  clienteIds: string[]
  empresas: { id: string; nombre: string }[]
  ready: boolean
}

/**
 * Contexto portal para media_contacto.
 * Usa admin client solo para resolver vínculos tras requireMediaContacto;
 * la autorización de negocio se revalida en cada action con asserts.
 * Con READY=false no consulta tablas nuevas.
 */
export const getMediaContactoContext = cache(
  async (): Promise<MediaContactoContext> => {
    const { user } = await requireMediaContacto()

    if (!MEDIA_EMPRESA_CONTACTOS_READY) {
      return {
        userId: user.id,
        contactoId: "",
        clienteIds: [],
        empresas: [],
        ready: false,
      }
    }

    const admin = createAdminClient()
    const { data: contactos, error } = await admin
      .from("media_cliente_contactos")
      .select(
        "id, cliente_id, nombre, email, telefono, cargo, auth_user_id, activo",
      )
      .eq("auth_user_id", user.id)
      .eq("activo", true)

    if (error) throw new Error(error.message)

    const rows = (contactos ?? []) as ContactoTableRow[]
    const drafts = contactosFromTableRows(rows)
    const clienteIds = [...new Set(rows.map((r) => r.cliente_id))]
    const contactoId = drafts[0]?.id ?? rows[0]?.id ?? ""

    let empresas: { id: string; nombre: string }[] = []
    if (clienteIds.length > 0) {
      const { data: clientes, error: clientesError } = await admin
        .from("media_clientes")
        .select("id, nombre, empresa")
        .in("id", clienteIds)
        .eq("activo", true)
      if (clientesError) throw new Error(clientesError.message)
      empresas = (clientes ?? []).map((c) => ({
        id: c.id as string,
        nombre: ((c.empresa as string | null) || (c.nombre as string)).trim(),
      }))
    }

    return {
      userId: user.id,
      contactoId,
      clienteIds,
      empresas,
      ready: true,
    }
  },
)
