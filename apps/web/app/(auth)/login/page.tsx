"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import {
  homeForRole,
  NO_ACCESS_MESSAGE,
  NO_ACCESS_QUERY,
  parseRol,
  roleFromAccessToken,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === NO_ACCESS_QUERY) {
      setError(NO_ACCESS_MESSAGE);
    }
  }, []);

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

    const rol =
      roleFromAccessToken(data.session?.access_token) ??
      parseRol(data.user.app_metadata);
    if (!rol) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(NO_ACCESS_MESSAGE);
      return;
    }

    router.replace(homeForRole(rol));
    router.refresh();
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
            </form>
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
