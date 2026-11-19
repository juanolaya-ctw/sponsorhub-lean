"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { parseAuthReturn, stripAuthReturnFromUrl } from "@/lib/auth/auth-return";
import { validarPasswordNueva } from "@/lib/auth/password";
import {
  homeForRole,
  parseRol,
  roleFromAccessToken,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type Fase =
  | { tipo: "cargando" }
  | { tipo: "confirmar"; tokenHash: string }
  | { tipo: "formulario" }
  | { tipo: "invalido" }
  | { tipo: "listo" };

/**
 * Aterrizaje del correo «Olvidé mi contraseña» en nuestro dominio.
 * - Retorno estándar de Supabase: #access_token…&type=recovery → setSession.
 * - Plantilla con {{ .TokenHash }} (?token_hash=…&type=recovery): no se
 *   consume nada hasta que la persona hace clic en «Continuar» (evita que
 *   escáneres de correo gasten el enlace).
 */
export default function RestablecerPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>({ tipo: "cargando" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash && url.searchParams.get("type") === "recovery") {
        setFase({ tipo: "confirmar", tokenHash });
        return;
      }

      const supabase = createClient();
      const ret = parseAuthReturn(window.location.href);
      if (ret.kind === "error") {
        window.history.replaceState(null, "", stripAuthReturnFromUrl(window.location.href));
        setFase({ tipo: "invalido" });
        return;
      }
      if (ret.kind === "hash_tokens" || ret.kind === "pkce_code") {
        const res =
          ret.kind === "hash_tokens"
            ? await supabase.auth.setSession({
                access_token: ret.accessToken,
                refresh_token: ret.refreshToken,
              })
            : await supabase.auth.exchangeCodeForSession(ret.code);
        window.history.replaceState(null, "", stripAuthReturnFromUrl(window.location.href));
        setFase(res.error || !res.data.session ? { tipo: "invalido" } : { tipo: "formulario" });
        return;
      }

      // Sin parámetros: si ya hay sesión (p. ej. recarga), permitir cambiarla.
      const { data } = await supabase.auth.getSession();
      setFase(data.session ? { tipo: "formulario" } : { tipo: "invalido" });
    };
    void run();
  }, []);

  async function handleContinuar() {
    if (fase.tipo !== "confirmar") return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: fase.tokenHash,
    });
    window.history.replaceState(null, "", window.location.pathname);
    setLoading(false);
    setFase(verifyError ? { tipo: "invalido" } : { tipo: "formulario" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validarPasswordNueva(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError("No pudimos guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.");
      return;
    }
    // Refrescar para que el JWT traiga el rol del hook.
    const { data } = await supabase.auth.refreshSession();
    const session = data.session;
    const rol =
      roleFromAccessToken(session?.access_token) ?? parseRol(session?.user.app_metadata);
    setFase({ tipo: "listo" });
    router.replace(rol ? homeForRole(rol) : "/login");
    router.refresh();
  }

  const fieldClass =
    "w-full rounded-[21px] border-0 bg-white px-6 py-4 text-base font-semibold text-[#040402] outline-none placeholder:font-semibold placeholder:text-[#868686] focus-visible:ring-2 focus-visible:ring-[#040402]/20";
  const buttonClass =
    "w-full rounded-[21px] bg-[#040402] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#040402]/90 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <main className="min-h-screen w-full bg-[#e9ebdf]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <BrandLogo className="h-8 w-auto" />
        <h1 className="mt-10 text-[32px] font-bold leading-[1.1] text-[#040402]">
          Crea tu contraseña
        </h1>

        {fase.tipo === "cargando" ? (
          <p className="mt-6 text-base font-semibold text-[#040402]">Verificando enlace…</p>
        ) : null}

        {fase.tipo === "confirmar" ? (
          <div className="mt-6 space-y-4">
            <p className="text-base font-semibold text-[#040402]">
              Haz clic para continuar y definir tu nueva contraseña.
            </p>
            <button type="button" className={buttonClass} disabled={loading} onClick={() => void handleContinuar()}>
              {loading ? "Verificando…" : "Continuar"}
            </button>
          </div>
        ) : null}

        {fase.tipo === "invalido" ? (
          <div className="mt-6 space-y-4">
            <p role="alert" className="rounded-[21px] bg-destructive/10 px-6 py-4 text-sm font-semibold text-destructive">
              Este enlace ya se usó o expiró. Pide uno nuevo desde «¿Olvidaste tu contraseña?».
            </p>
            <Link href="/login" className={`${buttonClass} block text-center`}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : null}

        {fase.tipo === "formulario" ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              aria-label="Nueva contraseña"
            />
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
              placeholder="Confirmar contraseña"
              aria-label="Confirmar contraseña"
            />
            {error ? (
              <p role="alert" className="rounded-[21px] bg-destructive/10 px-6 py-4 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <button type="submit" className={buttonClass} disabled={loading}>
              {loading ? "Guardando…" : "Guardar y entrar"}
            </button>
          </form>
        ) : null}

        {fase.tipo === "listo" ? (
          <p className="mt-6 text-base font-semibold text-[#040402]">Listo. Entrando al Hub…</p>
        ) : null}
      </div>
    </main>
  );
}
