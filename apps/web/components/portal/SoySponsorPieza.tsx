"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { guardarPiezaSoySponsor } from "@/lib/portal/pieza-actions";
import {
  componerPiezaSoySponsor,
  PIEZAS_BUCKET,
  piezaPath,
} from "@/lib/portal/soy-sponsor-pieza";

export type SoySponsorPiezaSponsor = {
  id: string;
  nombre: string;
  /** URL (firmada) del logo subido por el sponsor; null si aún no sube uno. */
  logoUrl: string | null;
  /** Nombre del logo subido cuando su formato no se puede usar (.ai, .pdf…). */
  logoNoSoportado: string | null;
  logoSubidoAt: string | null;
  /** URL (firmada) de la última pieza guardada, si existe. */
  piezaUrl: string | null;
  piezaGeneradaAt: string | null;
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SoySponsorPieza({ sponsor }: { sponsor: SoySponsorPiezaSponsor }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(sponsor.piezaUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const autoRan = useRef(false);

  const generar = useCallback(async () => {
    if (!sponsor.logoUrl) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await componerPiezaSoySponsor(sponsor.logoUrl);
      blobRef.current = blob;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(blob);
      setPreviewUrl(objectUrlRef.current);

      const path = piezaPath(sponsor.id);
      const { error: uploadError } = await createClient()
        .storage.from(PIEZAS_BUCKET)
        .upload(path, blob, { contentType: "image/png", upsert: true, cacheControl: "60" });
      if (uploadError) throw new Error(uploadError.message);

      const saved = await guardarPiezaSoySponsor(path);
      if (saved.error) throw new Error(saved.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la pieza.");
    } finally {
      setLoading(false);
    }
  }, [sponsor.id, sponsor.logoUrl]);

  // Genera sola si no hay pieza o si el logo se subió después de la última.
  useEffect(() => {
    if (autoRan.current || !sponsor.logoUrl) return;
    autoRan.current = true;
    const desactualizada =
      !sponsor.piezaUrl ||
      !sponsor.piezaGeneradaAt ||
      (sponsor.logoSubidoAt !== null &&
        new Date(sponsor.logoSubidoAt) > new Date(sponsor.piezaGeneradaAt));
    if (desactualizada) void generar();
  }, [generar, sponsor]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  async function descargar() {
    let blob = blobRef.current;
    if (!blob && previewUrl) {
      blob = await (await fetch(previewUrl)).blob();
    }
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `soy-sponsor-${slug(sponsor.nombre) || "pieza"}.png`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">Soy Sponsor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tu pieza para redes, lista para descargar.
      </p>

      {!sponsor.logoUrl ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="font-medium">
            {sponsor.logoNoSoportado
              ? "Necesitamos tu logo en PNG o SVG"
              : "Sube tu logo para generar tu pieza"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sponsor.logoNoSoportado
              ? `Tu logo actual (${sponsor.logoNoSoportado}) no se puede usar en la pieza. Sube una versión PNG o SVG y se arma automáticamente.`
              : "Apenas lo cargues (PNG o SVG), la pieza se arma automáticamente."}
          </p>
          <Button
            asChild
            className="mt-4 bg-[#040402] text-white hover:bg-[#040402]/90"
          >
            <Link href="/portal/recursos">Subir logo</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,280px)_1fr] sm:items-start">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-muted">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Pieza Soy Sponsor de ${sponsor.nombre}`}
                className="size-full object-cover"
              />
            ) : null}
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-sm font-medium">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                Componiendo tu pieza…
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => void descargar()}
              disabled={loading || !previewUrl}
              className="h-11 bg-[#040402] text-white hover:bg-[#040402]/90"
            >
              <Download aria-hidden />
              Descargar
            </Button>
            <Button
              variant="outline"
              onClick={() => void generar()}
              disabled={loading}
            >
              <RefreshCw aria-hidden />
              Regenerar
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG 1080×1350 px. Si cambias tu logo, pulsa Regenerar.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
