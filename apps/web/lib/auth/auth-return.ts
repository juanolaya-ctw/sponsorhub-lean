/**
 * Parseo seguro del retorno Auth (magiclink / PKCE) en el cliente.
 * No registra tokens; solo expone lo mínimo para setSession / exchange.
 */

export type AuthReturnKind = "none" | "hash_tokens" | "pkce_code" | "error"

export type ParsedAuthReturn =
  | { kind: "none" }
  | { kind: "hash_tokens"; accessToken: string; refreshToken: string }
  | { kind: "pkce_code"; code: string }
  | { kind: "error"; errorMessage: string }

const SENSITIVE_HASH_KEYS = new Set([
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "token_type",
  "expires_in",
  "expires_at",
  "sb",
])

const SENSITIVE_SEARCH_KEYS = new Set(["code", "token", "access_token", "refresh_token"])

const AUTH_ERROR_SEARCH_KEYS = new Set([
  "error",
  "error_code",
  "error_description",
])

export const AUTH_LINK_INVALID_MESSAGE =
  "El enlace de acceso no es válido o ya expiró."

export const humanizeAuthReturnError = (
  error: string | null,
  errorCode: string | null,
  errorDescription: string | null,
): string => {
  const code = (errorCode ?? "").toLowerCase()
  const desc = (errorDescription ?? "").toLowerCase()
  const err = (error ?? "").toLowerCase()

  if (
    code.includes("otp_expired") ||
    desc.includes("expired") ||
    err.includes("expired")
  ) {
    return AUTH_LINK_INVALID_MESSAGE
  }

  if (err || code || desc) return AUTH_LINK_INVALID_MESSAGE
  return AUTH_LINK_INVALID_MESSAGE
}

export const parseAuthReturn = (href: string): ParsedAuthReturn => {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return { kind: "none" }
  }

  const hashParams = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
  )
  const search = url.searchParams

  // Errores de Auth vienen en hash (implicit) o con error_code / error_description.
  // Query ?error=no_access|cuenta-desactivada es de la app; no es retorno Auth.
  const hashError = hashParams.get("error")
  const hashErrorCode = hashParams.get("error_code")
  const hashErrorDescription = hashParams.get("error_description")
  const searchErrorCode = search.get("error_code")
  const searchErrorDescription = search.get("error_description")
  const searchError = search.get("error")

  if (hashError || hashErrorCode) {
    return {
      kind: "error",
      errorMessage: humanizeAuthReturnError(
        hashError,
        hashErrorCode,
        hashErrorDescription,
      ),
    }
  }

  if (searchErrorCode || searchErrorDescription) {
    return {
      kind: "error",
      errorMessage: humanizeAuthReturnError(
        searchError,
        searchErrorCode,
        searchErrorDescription,
      ),
    }
  }

  const accessToken = hashParams.get("access_token")
  const refreshToken = hashParams.get("refresh_token")
  if (accessToken && refreshToken) {
    return { kind: "hash_tokens", accessToken, refreshToken }
  }

  const code = search.get("code")
  if (code) {
    return { kind: "pkce_code", code }
  }

  return { kind: "none" }
}

/** Path + query seguros, sin hash ni params sensibles de Auth. */
export const stripAuthReturnFromUrl = (href: string): string => {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return "/login"
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_SEARCH_KEYS.has(key) || AUTH_ERROR_SEARCH_KEYS.has(key)) {
      url.searchParams.delete(key)
    }
  }

  url.hash = ""
  return `${url.pathname}${url.search}`
}

export const authReturnHasSensitiveHash = (href: string): boolean => {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return false
  }
  const hashParams = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
  )
  for (const key of hashParams.keys()) {
    if (SENSITIVE_HASH_KEYS.has(key)) return true
  }
  return Boolean(hashParams.get("error") || hashParams.get("error_code"))
}
