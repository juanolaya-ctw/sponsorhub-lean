/**
 * Contraseñas generadas para accesos de clientes (se muestran una sola vez
 * al admin). Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para que se
 * puedan dictar o copiar sin errores. Usa Web Crypto (navegador y Node ≥ 19).
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "-_.!?"
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

export const PASSWORD_MIN = 8
export const PASSWORD_GENERADA_LEN = 16

const randomIndex = (max: number): number => {
  // Rechazo de muestreo para evitar sesgo de módulo.
  const limit = Math.floor(256 / max) * max
  const buf = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
}

const pick = (set: string): string => set[randomIndex(set.length)]!

/** Contraseña aleatoria con al menos una minúscula, mayúscula, dígito y símbolo. */
export const generarPasswordSegura = (length = PASSWORD_GENERADA_LEN): string => {
  const len = Math.max(12, length)
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < len) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join("")
}

export const validarPasswordNueva = (
  password: string,
  confirm: string,
): string | null => {
  if (password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  }
  if (password.length > 72) return "La contraseña es demasiado larga (máx. 72)."
  if (password !== confirm) return "Las contraseñas no coinciden."
  return null
}
