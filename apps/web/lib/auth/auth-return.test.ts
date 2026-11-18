import { describe, expect, it } from "vitest"
import {
  AUTH_LINK_INVALID_MESSAGE,
  authReturnHasSensitiveHash,
  parseAuthReturn,
  stripAuthReturnFromUrl,
} from "./auth-return"

describe("parseAuthReturn", () => {
  it("detecta tokens implícitos en hash (magiclink)", () => {
    const parsed = parseAuthReturn(
      "http://localhost:3000/login#access_token=aaa&refresh_token=bbb&type=magiclink&token_type=bearer",
    )
    expect(parsed).toEqual({
      kind: "hash_tokens",
      accessToken: "aaa",
      refreshToken: "bbb",
    })
  })

  it("detecta code PKCE en query", () => {
    const parsed = parseAuthReturn(
      "http://localhost:3000/login?code=abc123&type=magiclink",
    )
    expect(parsed).toEqual({ kind: "pkce_code", code: "abc123" })
  })

  it("detecta enlace vencido o inválido en hash", () => {
    const parsed = parseAuthReturn(
      "http://localhost:3000/login#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    )
    expect(parsed.kind).toBe("error")
    if (parsed.kind === "error") {
      expect(parsed.errorMessage).toBe(AUTH_LINK_INVALID_MESSAGE)
    }
  })

  it("sin retorno Auth devuelve none", () => {
    expect(parseAuthReturn("http://localhost:3000/login").kind).toBe("none")
    expect(
      parseAuthReturn("http://localhost:3000/login?error=no_access").kind,
    ).toBe("none")
  })
})

describe("stripAuthReturnFromUrl", () => {
  it("elimina hash sensible y deja /login limpio", () => {
    expect(
      stripAuthReturnFromUrl(
        "http://localhost:3000/login#access_token=secret&refresh_token=secret2",
      ),
    ).toBe("/login")
  })

  it("elimina code y errores de query; conserva otros params", () => {
    expect(
      stripAuthReturnFromUrl(
        "http://localhost:3000/login?code=xyz&error=access_denied&utm=1",
      ),
    ).toBe("/login?utm=1")
  })
})

describe("authReturnHasSensitiveHash", () => {
  it("marca hash con access_token", () => {
    expect(
      authReturnHasSensitiveHash(
        "http://localhost:3000/login#access_token=x&refresh_token=y",
      ),
    ).toBe(true)
  })

  it("no marca login limpio", () => {
    expect(authReturnHasSensitiveHash("http://localhost:3000/login")).toBe(
      false,
    )
  })
})
