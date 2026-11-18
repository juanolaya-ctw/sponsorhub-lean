/**
 * Adaptador CRM empresa + contactos.
 * Esquema vigente: media_clientes (legacy).
 * Tras 0024 + MEDIA_EMPRESA_CONTACTOS_READY=true: media_cliente_contactos.
 * No consulta la tabla nueva mientras el flag esté en false.
 */

import {
  MEDIA_EMPRESA_CONTACTOS_READY,
} from "@/lib/media/media-contacto-auth"

export const MEDIA_CONTACTOS_TABLE = "media_cliente_contactos"

/** Alias del flag de activación conjunta (migración + OK). */
export const MEDIA_CONTACTOS_TABLE_READY = MEDIA_EMPRESA_CONTACTOS_READY

export type MediaClienteLegacyRow = {
  id?: string
  nombre: string
  empresa: string | null
  email_contacto?: string | null
  telefono?: string | null
  notas?: string | null
  activo?: boolean
}

export type ContactoDraft = {
  key: string
  /** id en media_cliente_contactos cuando READY */
  id?: string | null
  nombre: string
  email: string
  telefono: string
  cargo: string
  authUserId?: string | null
}

export type EmpresaCrmView = {
  clienteId: string | null
  empresaNombre: string
  contactos: ContactoDraft[]
  filaEmpresa: {
    email: string | null
    telefono: string | null
    notas: string | null
  }
  dudas: string[]
}

export type LegacyClienteWrite = {
  nombre: string
  empresa: string | null
  email_contacto: string | null
  telefono: string | null
}

export type PersistEmpresaContactosResult =
  | {
      ok: true
      legacy: LegacyClienteWrite
      contactos: ContactoDraft[]
      mode: "legacy" | "table"
    }
  | { ok: false; error: string }

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim()
  return trimmed.length > 0 ? trimmed : null
}

export const newContactoKey = (): string =>
  `local-${Math.random().toString(36).slice(2, 10)}`

export const emptyContacto = (): ContactoDraft => ({
  key: newContactoKey(),
  id: null,
  nombre: "",
  email: "",
  telefono: "",
  cargo: "",
  authUserId: null,
})

export const resolveEmpresaNombre = (
  row: Pick<MediaClienteLegacyRow, "nombre" | "empresa">,
): { empresaNombre: string; dudas: string[] } => {
  const empresa = blankToNull(row.empresa)
  if (empresa) return { empresaNombre: empresa, dudas: [] }
  return {
    empresaNombre: row.nombre.trim(),
    dudas: ["empresa_null_nombre_usado_como_etiqueta_empresa"],
  }
}

/**
 * Contactos desde fila legacy. No copia email/tel. No divide por "&".
 */
export const contactosFromLegacyRow = (
  row: Pick<MediaClienteLegacyRow, "nombre" | "empresa">,
): { contactos: ContactoDraft[]; dudas: string[] } => {
  const empresa = blankToNull(row.empresa)
  const nombre = row.nombre.trim()
  const dudas: string[] = []

  if (!nombre) return { contactos: [], dudas }

  if (empresa && nombre.toLowerCase() === empresa.toLowerCase()) {
    return { contactos: [], dudas }
  }

  if (empresa && nombre.toLowerCase() !== empresa.toLowerCase()) {
    dudas.push("nombre_puede_ser_contacto_sin_confirmar")
  }
  if (nombre.includes("&")) {
    dudas.push("nombre_contiene_ampersand_no_dividir_sin_decision")
  }

  return {
    contactos: [
      {
        key: newContactoKey(),
        id: null,
        nombre,
        email: "",
        telefono: "",
        cargo: "",
        authUserId: null,
      },
    ],
    dudas,
  }
}

export const toEmpresaCrmView = (
  row: MediaClienteLegacyRow,
): EmpresaCrmView => {
  const { empresaNombre, dudas: d1 } = resolveEmpresaNombre(row)
  const { contactos, dudas: d2 } = contactosFromLegacyRow(row)
  const email = blankToNull(row.email_contacto)
  const telefono = blankToNull(row.telefono)
  const dudas = [...d1, ...d2]
  if (email || telefono) {
    dudas.push("email_telefono_en_fila_empresa_sin_asignar_a_contacto")
  }

  return {
    clienteId: row.id ?? null,
    empresaNombre,
    contactos,
    filaEmpresa: {
      email,
      telefono,
      notas: blankToNull(row.notas),
    },
    dudas,
  }
}

export const MULTI_CONTACT_LEGACY_BLOCK =
  "El esquema vigente solo guarda un contacto por empresa (columna nombre). Con dos o más contactos con nombre se descartarían al guardar. Quita los extras o espera a conectar la tabla media_cliente_contactos. No se ha modificado ningún dato."

export const namedContactosCount = (contactos: ContactoDraft[]): number =>
  contactos.filter((c) => c.nombre.trim().length > 0).length

export const legacyWriteBlockedReason = (
  contactos: ContactoDraft[],
): string | null => {
  if (MEDIA_CONTACTOS_TABLE_READY) return null
  if (namedContactosCount(contactos) > 1) return MULTI_CONTACT_LEGACY_BLOCK
  return null
}

/**
 * Persistencia esquema vigente (sin pérdida silenciosa).
 * Bloquea 2+ contactos nombrados mientras la tabla nueva no esté lista.
 */
export const toLegacyClienteWrite = (input: {
  empresaNombre: string
  contactos: ContactoDraft[]
  filaEmail: string | null | undefined
  filaTelefono: string | null | undefined
}): LegacyClienteWrite | { error: string } => {
  const empresaNombre = input.empresaNombre.trim()
  if (!empresaNombre) {
    return { error: "El nombre de empresa es requerido." }
  }

  const blocked = legacyWriteBlockedReason(input.contactos)
  if (blocked) return { error: blocked }

  const firstNamed = input.contactos.find((c) => c.nombre.trim().length > 0)
  const nombre = firstNamed?.nombre.trim() || empresaNombre

  return {
    nombre,
    empresa: empresaNombre,
    email_contacto: blankToNull(input.filaEmail),
    telefono: blankToNull(input.filaTelefono),
  }
}

/**
 * Persistencia lista para tabla nueva: no concatena ni descarta.
 * Con READY=false delega a legacy (con bloqueo multi).
 * Con READY=true exige al menos empresa; contactos se escriben fila a fila
 * vía deps (sin queries reales en este módulo).
 */
export const planPersistEmpresaContactos = (input: {
  empresaNombre: string
  contactos: ContactoDraft[]
  filaEmail: string | null | undefined
  filaTelefono: string | null | undefined
}): PersistEmpresaContactosResult => {
  const empresaNombre = input.empresaNombre.trim()
  if (!empresaNombre) {
    return { ok: false, error: "El nombre de empresa es requerido." }
  }

  const named = input.contactos.filter((c) => c.nombre.trim().length > 0)

  if (!MEDIA_CONTACTOS_TABLE_READY) {
    const legacy = toLegacyClienteWrite(input)
    if ("error" in legacy) return { ok: false, error: legacy.error }
    return {
      ok: true,
      legacy,
      contactos: named,
      mode: "legacy",
    }
  }

  // Tabla lista: empresa en media_clientes; N contactos sin pérdida.
  // nombre legacy = empresa (etiqueta estable); email/tel fila se conservan.
  return {
    ok: true,
    legacy: {
      nombre: empresaNombre,
      empresa: empresaNombre,
      email_contacto: blankToNull(input.filaEmail),
      telefono: blankToNull(input.filaTelefono),
    },
    contactos: named.map((c) => ({
      ...c,
      nombre: c.nombre.trim(),
      email: c.email.trim(),
      telefono: c.telefono.trim(),
      cargo: c.cargo.trim(),
    })),
    mode: "table",
  }
}

export const loadContactosForCrm = async (
  row: MediaClienteLegacyRow,
  deps?: { queryContactsTable?: () => Promise<ContactoDraft[]> },
): Promise<EmpresaCrmView> => {
  if (MEDIA_CONTACTOS_TABLE_READY && deps?.queryContactsTable) {
    const view = toEmpresaCrmView(row)
    const fromTable = await deps.queryContactsTable()
    return {
      ...view,
      empresaNombre: resolveEmpresaNombre(row).empresaNombre,
      contactos: fromTable,
      dudas: [],
    }
  }
  return toEmpresaCrmView(row)
}

export type ContactoTableRow = {
  id: string
  cliente_id: string
  nombre: string
  email: string | null
  telefono: string | null
  cargo: string | null
  auth_user_id: string | null
  activo: boolean
}

export const contactosFromTableRows = (
  rows: ContactoTableRow[],
): ContactoDraft[] =>
  rows
    .filter((r) => r.activo)
    .map((r) => ({
      key: r.id,
      id: r.id,
      nombre: r.nombre,
      email: r.email ?? "",
      telefono: r.telefono ?? "",
      cargo: r.cargo ?? "",
      authUserId: r.auth_user_id,
    }))
