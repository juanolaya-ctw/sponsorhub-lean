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

  return (
    <main className="rounded-2xl border border-border bg-card p-8 shadow-md">
      <BrandLogo className="h-8" />
      <h1 className="mt-4 text-2xl font-semibold text-foreground">SponsorHub</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Inicia sesión con el correo que te asignó el equipo de CT.
      </p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="tu@empresa.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Ingresando…" : "Iniciar sesión"}
        </button>
      </form>
    </main>
  );
}
