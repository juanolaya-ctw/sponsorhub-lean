"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  countWords,
  TIPO_LINKEDIN_INSTAGRAM,
  type LinkedInInstagramPayload,
} from "@/lib/portal/beneficios";

const MAX_PALABRAS = 80;

type ArchivoActual = {
  id: string;
  nombre: string;
  storagePath: string;
};

function WordCounter({ count, max }: { count: number; max: number }) {
  const over = count > max;
  return (
    <span
      className={
        over ? "text-xs text-destructive" : "text-xs text-muted-foreground"
      }
    >
      {count} / {max} palabras
    </span>
  );
}

export function LinkedInInstagramForm({
  sponsorId,
  userId,
  compromisoId,
  detalleSolicitud,
  initial,
  archivo,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  detalleSolicitud?: string | null;
  initial: LinkedInInstagramPayload | null;
  archivo: ArchivoActual | null;
}) {
  const router = useRouter();
  const [datoImpactante, setDatoImpactante] = useState(
    initial?.dato_impactante ?? "",
  );
  const [parrafo1, setParrafo1] = useState(initial?.parrafo1 ?? "");
  const [parrafo2, setParrafo2] = useState(initial?.parrafo2 ?? "");
  const [parrafo3, setParrafo3] = useState(initial?.parrafo3 ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const palabras1 = countWords(parrafo1);
  const palabras2 = countWords(parrafo2);
  const palabras3 = countWords(parrafo3);
  const overLimit =
    palabras1 > MAX_PALABRAS ||
    palabras2 > MAX_PALABRAS ||
    palabras3 > MAX_PALABRAS;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datoImpactante.trim()) {
      setError("El dato impactante es obligatorio.");
      return;
    }
    if (palabras1 === 0 || palabras1 > MAX_PALABRAS) {
      setError(
        `El párrafo 1 debe tener entre 1 y ${MAX_PALABRAS} palabras.`,
      );
      return;
    }
    if (palabras2 === 0 || palabras2 > MAX_PALABRAS) {
      setError(
        `El párrafo 2 debe tener entre 1 y ${MAX_PALABRAS} palabras.`,
      );
      return;
    }
    if (palabras3 > MAX_PALABRAS) {
      setError(`El párrafo 3 no puede superar ${MAX_PALABRAS} palabras.`);
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const payload: LinkedInInstagramPayload = {
      dato_impactante: datoImpactante.trim(),
      parrafo1: parrafo1.trim(),
      parrafo2: parrafo2.trim(),
      parrafo3: parrafo3.trim(),
    };
    const nombreArchivo = JSON.stringify(payload);
    const storagePath = `linkedin_instagram_${compromisoId}.json`;

    if (archivo) {
      const { error: updateError } = await supabase
        .from("archivos")
        .update({
          tipo: TIPO_LINKEDIN_INSTAGRAM,
          nombre_archivo: nombreArchivo,
          storage_path: storagePath,
        })
        .eq("id", archivo.id)
        .eq("sponsor_id", sponsorId);
      if (updateError) {
        setError(updateError.message);
        setPending(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("archivos").insert({
        sponsor_id: sponsorId,
        direccion: "sponsor_sube",
        tipo: TIPO_LINKEDIN_INSTAGRAM,
        nombre_archivo: nombreArchivo,
        storage_path: storagePath,
        subido_por: userId,
        compromiso_id: compromisoId,
      });
      if (insertError) {
        setError(insertError.message);
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!archivo) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("archivos")
      .delete()
      .eq("id", archivo.id)
      .eq("sponsor_id", sponsorId);
    if (deleteError) {
      setError(deleteError.message);
      setPending(false);
      return;
    }
    setDatoImpactante("");
    setParrafo1("");
    setParrafo2("");
    setParrafo3("");
    setPending(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="font-semibold">Contenido LinkedIn + Instagram</h2>
      {detalleSolicitud ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {detalleSolicitud}
        </p>
      ) : null}
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mt-4 space-y-4"
      >
        <div>
          <Label htmlFor="li-dato">¿Cuál es su dato impactante?</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Un número, porcentaje, logro o resultado concreto
          </p>
          <Input
            id="li-dato"
            value={datoImpactante}
            onChange={(event) => setDatoImpactante(event.target.value)}
            className="mt-1"
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="li-p1">Párrafo 1 — Contexto del dato</Label>
            <WordCounter count={palabras1} max={MAX_PALABRAS} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ¿Cuándo lograron esto? Máx. 80 palabras.
          </p>
          <Textarea
            id="li-p1"
            value={parrafo1}
            rows={4}
            className="mt-1"
            onChange={(event) => setParrafo1(event.target.value)}
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="li-p2">Párrafo 2 — Impacto interno</Label>
            <WordCounter count={palabras2} max={MAX_PALABRAS} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ¿Qué cambió gracias a este logro? Máx. 80 palabras.
          </p>
          <Textarea
            id="li-p2"
            value={parrafo2}
            rows={4}
            className="mt-1"
            onChange={(event) => setParrafo2(event.target.value)}
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="li-p3">
              Párrafo 3 — Mensaje al ecosistema (opcional)
            </Label>
            <WordCounter count={palabras3} max={MAX_PALABRAS} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ¿Qué aprendizaje quieren compartir? Máx. 80 palabras.
          </p>
          <Textarea
            id="li-p3"
            value={parrafo3}
            rows={4}
            className="mt-1"
            onChange={(event) => setParrafo3(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending || overLimit}>
            {pending
              ? "Guardando…"
              : archivo
                ? "Guardar cambios"
                : "Guardar contenido"}
          </Button>
          {archivo ? (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void remove()}
            >
              Eliminar
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </section>
  );
}
