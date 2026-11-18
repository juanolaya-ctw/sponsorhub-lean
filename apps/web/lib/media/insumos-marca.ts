/**
 * Insumos de marca reutilizables por empresa (Media): logo original, logo
 * blanco/negro y manual de marca. La foto del vocero es por pieza.
 *
 * Mismo patrón que el lado de eventos (lib/portal/beneficios.ts →
 * attachLogosCompartidos): un archivo tipado (`tipo`, como archivos.tipo =
 * "logo_ai") subido una vez por la empresa cuenta como "Cargado" en todas las
 * piezas que lo piden. Aquí vive a nivel empresa (media_cliente_insumos_marca),
 * no en la pieza, para que borrar una pieza no borre el logo de las demás.
 *
 * Puro / testeable.
 */
import {
  MEDIA_INSUMOS_STORAGE_PREFIX,
  assertClienteAuthorized,
  assertMediaContactoProfile,
  resolveAuthorizedClienteIds,
  safeMediaFilename,
  type MediaContactoAuthProfile,
  type MediaContactoLink,
} from "./media-contacto-auth"
import { normalizarNombreAsset, parseChecklist } from "./portal-cliente"

export const MARCA_FOLDER = "marca"

export const TIPOS_MARCA = [
  {
    tipo: "logo_original",
    label: "Logo original (PNG)",
    // "Logo Original (png)"
    match: (n: string) => /\blogo original\b/.test(n),
  },
  {
    tipo: "logo_bn",
    label: "Logo blanco / negro (PNG)",
    // "Logo Blanco/Negro (png)"
    match: (n: string) =>
      /\blogo\b/.test(n) && (/\bblanco\b/.test(n) || /\bnegro\b/.test(n) || /\bb n\b/.test(n)),
  },
  {
    tipo: "manual_marca",
    label: "Manual de marca",
    // "Manual Marca"
    match: (n: string) => /\bmanual (de )?marca\b/.test(n),
  },
] as const

export type TipoMarca = (typeof TIPOS_MARCA)[number]["tipo"]

export const isTipoMarca = (value: string): value is TipoMarca =>
  TIPOS_MARCA.some((t) => t.tipo === value)

export const labelTipoMarca = (tipo: TipoMarca): string =>
  TIPOS_MARCA.find((t) => t.tipo === tipo)!.label

/** Tipo de insumo de marca al que corresponde un ítem del checklist, o null. */
export function tipoMarcaDeItem(item: string): TipoMarca | null {
  const n = normalizarNombreAsset(item)
  for (const t of TIPOS_MARCA) {
    if (t.match(n)) return t.tipo
  }
  return null
}

export type ArchivoMarca = {
  id: string
  clienteId: string
  tipo: TipoMarca
  nombreArchivo: string
  storagePath: string
  createdAt: string
}

/** Último archivo por tipo (el más reciente reemplaza a los anteriores). */
export function ultimoPorTipo(
  rows: readonly ArchivoMarca[],
): Map<TipoMarca, ArchivoMarca> {
  const out = new Map<TipoMarca, ArchivoMarca>()
  for (const r of rows) {
    const cur = out.get(r.tipo)
    if (!cur || Date.parse(r.createdAt) > Date.parse(cur.createdAt)) {
      out.set(r.tipo, r)
    }
  }
  return out
}

export type ItemChecklist =
  | { texto: string; tipo: TipoMarca; cargado: ArchivoMarca | null }
  | { texto: string; tipo: null; cargado: null }

export function clasificarChecklist(
  texto: string | null | undefined,
  cargados: ReadonlyMap<TipoMarca, ArchivoMarca>,
): ItemChecklist[] {
  return parseChecklist(texto).map((item) => {
    const tipo = tipoMarcaDeItem(item)
    if (!tipo) return { texto: item, tipo: null, cargado: null }
    return { texto: item, tipo, cargado: cargados.get(tipo) ?? null }
  })
}

/**
 * ¿Hay que pedirle algo al cliente en esta pieza?
 * Solo aplica en pendiente_insumos (no cambia el estado en BD).
 * - Falta algún insumo de marca → sí.
 * - Hay ítems propios de la pieza y aún no subió ningún archivo a la pieza → sí.
 * - Sin checklist: sí mientras no haya subido nada a la pieza.
 * Un insumo de marca ya cargado nunca cuenta como pendiente.
 */
export function piezaEsperaAlCliente(input: {
  estado: string
  items: readonly ItemChecklist[]
  archivosPieza: number
}): boolean {
  if (input.estado !== "pendiente_insumos") return false
  const faltaMarca = input.items.some((i) => i.tipo !== null && !i.cargado)
  if (faltaMarca) return true
  const propios = input.items.filter((i) => i.tipo === null).length
  if (input.items.length === 0) return input.archivosPieza === 0
  return propios > 0 && input.archivosPieza === 0
}

// ── Storage / autorización ───────────────────────────────────────────────────

export const buildMarcaStoragePath = (input: {
  clienteId: string
  tipo: TipoMarca
  uuid: string
  filename: string
}): string =>
  `${MEDIA_INSUMOS_STORAGE_PREFIX}/${input.clienteId}/${MARCA_FOLDER}/${input.tipo}/${input.uuid}-${safeMediaFilename(input.filename)}`

export const assertMarcaPath = (input: {
  storagePath: string
  clienteId: string
  tipo?: string
}): { ok: true } | { ok: false; error: string } => {
  const parts = input.storagePath.split("/")
  if (
    parts.length < 5 ||
    parts[0] !== MEDIA_INSUMOS_STORAGE_PREFIX ||
    parts[2] !== MARCA_FOLDER ||
    !isTipoMarca(parts[3] ?? "") ||
    !parts[4]
  ) {
    return { ok: false, error: "Ruta de almacenamiento inválida." }
  }
  if (parts[1] !== input.clienteId) {
    return { ok: false, error: "La ruta no corresponde a la empresa." }
  }
  if (input.tipo && parts[3] !== input.tipo) {
    return { ok: false, error: "La ruta no corresponde al tipo de insumo." }
  }
  return { ok: true }
}

export type UploadMarcaPlan =
  | {
      ok: true
      storagePath: string
      insert: {
        cliente_id: string
        tipo: TipoMarca
        contacto_id: string | null
        nombre_archivo: string
        storage_path: string
        subido_por: string
      }
    }
  | { ok: false; error: string }

/** Upload por media_contacto: empresa vinculada + tipo válido + path canónico. */
export function authorizeUploadMarcaContacto(input: {
  profile: MediaContactoAuthProfile
  links: MediaContactoLink[]
  clienteId: string
  tipo: string
  filename: string
  uuid: string
}): UploadMarcaPlan {
  const p = assertMediaContactoProfile(input.profile)
  if (!p.ok) return p
  const authorized = resolveAuthorizedClienteIds(input.links, input.profile.userId)
  const c = assertClienteAuthorized(authorized, input.clienteId)
  if (!c.ok) return c
  if (!isTipoMarca(input.tipo)) return { ok: false, error: "Tipo de insumo inválido." }
  const link = input.links.find(
    (l) => l.activo && l.authUserId === input.profile.userId && l.clienteId === input.clienteId,
  )
  if (!link) return { ok: false, error: "Contacto no vinculado a esta empresa." }
  return planMarca({
    clienteId: input.clienteId,
    tipo: input.tipo,
    filename: input.filename,
    uuid: input.uuid,
    userId: input.profile.userId,
    contactoId: link.contactoId,
  })
}

/** Upload por admin (ya validado con requireAdmin en la action). */
export function planUploadMarcaAdmin(input: {
  clienteId: string
  tipo: string
  filename: string
  uuid: string
  userId: string
}): UploadMarcaPlan {
  if (!isTipoMarca(input.tipo)) return { ok: false, error: "Tipo de insumo inválido." }
  return planMarca({ ...input, tipo: input.tipo, contactoId: null })
}

function planMarca(input: {
  clienteId: string
  tipo: TipoMarca
  filename: string
  uuid: string
  userId: string
  contactoId: string | null
}): UploadMarcaPlan {
  if (!input.filename.trim()) return { ok: false, error: "Archivo sin nombre." }
  const storagePath = buildMarcaStoragePath(input)
  const check = assertMarcaPath({ storagePath, clienteId: input.clienteId, tipo: input.tipo })
  if (!check.ok) return check
  return {
    ok: true,
    storagePath,
    insert: {
      cliente_id: input.clienteId,
      tipo: input.tipo,
      contacto_id: input.contactoId,
      nombre_archivo: input.filename,
      storage_path: storagePath,
      subido_por: input.userId,
    },
  }
}

/** Descarga por media_contacto: el archivo debe ser de una empresa vinculada. */
export function authorizeDownloadMarcaContacto(input: {
  profile: MediaContactoAuthProfile
  links: MediaContactoLink[]
  archivo: Pick<ArchivoMarca, "clienteId" | "storagePath"> | null
}): { ok: true; storagePath: string } | { ok: false; error: string } {
  const p = assertMediaContactoProfile(input.profile)
  if (!p.ok) return p
  if (!input.archivo) return { ok: false, error: "Archivo no encontrado." }
  const authorized = resolveAuthorizedClienteIds(input.links, input.profile.userId)
  const c = assertClienteAuthorized(authorized, input.archivo.clienteId)
  if (!c.ok) return c
  const path = assertMarcaPath({
    storagePath: input.archivo.storagePath,
    clienteId: input.archivo.clienteId,
  })
  if (!path.ok) return path
  return { ok: true, storagePath: input.archivo.storagePath }
}

/** Tabla aún no creada (migración 0027 pendiente): el portal sigue operando sin marca. */
export const isMissingTableError = (
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean =>
  Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        /does not exist|could not find the table/i.test(error.message ?? "")),
  )
