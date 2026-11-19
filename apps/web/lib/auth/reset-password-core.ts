/**
 * «Olvidé mi contraseña»: solo envía el correo de restablecimiento a
 * contactos Media vinculados y activos. Respuesta siempre genérica (no
 * revela si el correo existe). I/O por deps para test sin Supabase.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const RESET_PATH = "/restablecer"

export const MENSAJE_RESET_ENVIADO =
  "Si ese correo tiene un acceso activo al Hub, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y spam."

export type ContactoParaReset = {
  contactoActivo: boolean
  authUserId: string | null
  profileRol: string | null
  profileActivo: boolean | null
  authEmail: string | null
}

export type ResetDeps = {
  findContactosByEmail: (email: string) => Promise<ContactoParaReset[]>
  sendResetEmail: (email: string) => Promise<{ error: string | null }>
}

export const normalizarEmail = (raw: string): string | null => {
  const email = raw.trim().toLowerCase()
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null
  return email
}

export const contactoPuedeRestablecer = (
  c: ContactoParaReset,
  email: string,
): boolean =>
  c.contactoActivo &&
  Boolean(c.authUserId) &&
  c.profileRol === "media_contacto" &&
  c.profileActivo !== false &&
  (c.authEmail ?? "").trim().toLowerCase() === email

export const runSolicitarReset = async (
  deps: ResetDeps,
  rawEmail: string,
): Promise<{ enviado: boolean; mensaje: string }> => {
  const email = normalizarEmail(rawEmail)
  if (!email) return { enviado: false, mensaje: "Escribe un correo válido." }
  const contactos = await deps.findContactosByEmail(email)
  if (!contactos.some((c) => contactoPuedeRestablecer(c, email))) {
    return { enviado: false, mensaje: MENSAJE_RESET_ENVIADO }
  }
  const { error } = await deps.sendResetEmail(email)
  return { enviado: !error, mensaje: MENSAJE_RESET_ENVIADO }
}
