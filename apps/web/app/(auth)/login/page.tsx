"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import {
  AUTH_LINK_INVALID_MESSAGE,
  parseAuthReturn,
  stripAuthReturnFromUrl,
} from "@/lib/auth/auth-return";
import {
  DEACTIVATED_ACCOUNT_MESSAGE,
  DEACTIVATED_ACCOUNT_QUERY,
  homeForRole,
  NO_ACCESS_MESSAGE,
  NO_ACCESS_QUERY,
  parseRol,
  roleFromAccessToken,
  type UserRole,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { solicitarRestablecimientoPassword } from "./actions";

const finishSignIn = async (
  supabase: ReturnType<typeof createClient>,
  accessToken: string | undefined,
  user: { id: string; app_metadata?: unknown },
): Promise<{ ok: true; rol: UserRole } | { ok: false; message: string }> => {
  const rol = roleFromAccessToken(accessToken) ?? parseRol(user.app_metadata);
  if (!rol) {
    await supabase.auth.signOut();
    return { ok: false, message: NO_ACCESS_MESSAGE };
  }

  if (rol === "sponsor" || rol === "media_contacto") {
    const { data: profile } = await supabase
      .from("sponsor_usuarios")
      .select("activo")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.activo === false) {
      await supabase.auth.signOut();
      return { ok: false, message: DEACTIVATED_ACCOUNT_MESSAGE };
    }
  }

  return { ok: true, rol };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modoReset, setModoReset] = useState(false);
  const [resetMensaje, setResetMensaje] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleAuthReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      if (errorParam === NO_ACCESS_QUERY) {
        setError(NO_ACCESS_MESSAGE);
      } else if (errorParam === DEACTIVATED_ACCOUNT_QUERY) {
        setError(DEACTIVATED_ACCOUNT_MESSAGE);
      }

      const authReturn = parseAuthReturn(window.location.href);
      if (authReturn.kind === "none") return;

      if (authReturn.kind === "error") {
        window.history.replaceState(
          null,
          "",
          stripAuthReturnFromUrl(window.location.href),
        );
        if (!cancelled) setError(authReturn.errorMessage);
        return;
      }

      setLoading(true);
      setError(null);
      const supabase = createClient();

      const sessionResult =
        authReturn.kind === "hash_tokens"
          ? await supabase.auth.setSession({
              access_token: authReturn.accessToken,
              refresh_token: authReturn.refreshToken,
            })
          : await supabase.auth.exchangeCodeForSession(authReturn.code);

      window.history.replaceState(
        null,
        "",
        stripAuthReturnFromUrl(window.location.href),
      );

      if (cancelled) return;

      if (sessionResult.error || !sessionResult.data.session?.user) {
        setLoading(false);
        setError(AUTH_LINK_INVALID_MESSAGE);
        return;
      }

      const finished = await finishSignIn(
        supabase,
        sessionResult.data.session.access_token,
        sessionResult.data.session.user,
      );

      if (cancelled) return;

      if (!finished.ok) {
        setLoading(false);
        setError(finished.message);
        return;
      }

      // Solo destinos internos por rol (ROLE_HOME); nunca redirect externo.
      router.replace(homeForRole(finished.rol));
      router.refresh();
    };

    void handleAuthReturn();
    // Si ya estamos en /login y cambia el hash (enlace), reprocesar.
    window.addEventListener("hashchange", handleAuthReturn);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", handleAuthReturn);
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError("Email o contraseña incorrectos.");
      return;
    }

    const finished = await finishSignIn(
      supabase,
      data.session?.access_token,
      data.user,
    );

    if (!finished.ok) {
      setLoading(false);
      setError(finished.message);
      return;
    }

    router.replace(homeForRole(finished.rol));
    router.refresh();
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResetMensaje(null);
    setLoading(true);
    try {
      const { mensaje } = await solicitarRestablecimientoPassword(email);
      setResetMensaje(mensaje);
    } catch {
      setError("No pudimos enviar el correo. Intenta de nuevo en unos minutos.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    "w-full rounded-[21px] border-0 bg-white px-6 py-4 text-base font-semibold text-[#040402] outline-none placeholder:font-semibold placeholder:text-[#868686] focus-visible:ring-2 focus-visible:ring-[#040402]/20";

  return (
    <main className="min-h-screen w-full bg-[#e9ebdf]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col md:grid md:grid-cols-2">
        {/* Columna izquierda: formulario, directamente sobre el fondo */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 md:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <BrandLogo className="h-8 w-auto" />

            <h1 className="mt-10 font-bold leading-[1.1] text-[32px] text-[#040402] sm:text-[40px] md:text-[51px]">
              Gestiona el status
              <br />
              de tu participación.
            </h1>

{modoReset ? (
            <form className="mt-10 space-y-4" onSubmit={handleReset}>
              <p className="text-base font-semibold text-[#040402]">
                Escribe tu correo y te enviamos un enlace para crear una
                contraseña nueva.
              </p>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass}
                placeholder="Correo electrónico"
                aria-label="Correo electrónico"
              />

              {error ? (
                <p
                  role="alert"
                  className="rounded-[21px] bg-destructive/10 px-6 py-4 text-sm font-semibold text-destructive"
                >
                  {error}
                </p>
              ) : null}
              {resetMensaje ? (
                <p
                  role="status"
                  className="rounded-[21px] bg-white px-6 py-4 text-sm font-semibold text-[#040402]"
                >
                  {resetMensaje}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[21px] bg-[#040402] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#040402]/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Enviando…" : "Enviarme el enlace"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoReset(false);
                  setError(null);
                  setResetMensaje(null);
                }}
                className="w-full text-center text-sm font-semibold text-[#040402] underline underline-offset-4 hover:opacity-80"
              >
                Volver a iniciar sesión
              </button>
            </form>
            ) : (
            <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={fieldClass}
                placeholder="Correo electrónico"
                aria-label="Correo electrónico"
              />

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={fieldClass}
                placeholder="Contraseña"
                aria-label="Contraseña"
              />

              {error ? (
                <p
                  role="alert"
                  className="rounded-[21px] bg-destructive/10 px-6 py-4 text-sm font-semibold text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[21px] bg-[#040402] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#040402]/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Ingresando…" : "Iniciar sesión"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoReset(true);
                  setError(null);
                  setResetMensaje(null);
                }}
                className="w-full text-center text-sm font-semibold text-[#040402] underline underline-offset-4 hover:opacity-80"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
            )}
          </div>
        </div>

        {/* Columna derecha: ilustración, centrada y sin distorsión */}
        <div className="hidden self-stretch md:flex md:items-center md:justify-center md:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration-login.png"
            alt=""
            aria-hidden
            className="h-auto max-h-[80%] w-auto max-w-[85%] object-contain"
          />
        </div>
      </div>
    </main>
  );
}
