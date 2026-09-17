"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  ARCHIVOS_BUCKET,
  countWords,
  isStoredObject,
  safeFilename,
  TIPO_NEWSLETTER,
  type NewsletterPayload,
} from "@/lib/portal/beneficios";

async function removeStorageIfOrphan(
  supabase: ReturnType<typeof createClient>,
  path: string,
) {
  if (!isStoredObject(path)) return;
  const { count } = await supabase
    .from("archivos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", path);
  if (!count) {
    await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
  }
}

const MAX_TITULO = 60;
const MAX_PALABRAS = 100;
const IMAGE_SIZE = 1080;

type ArchivoActual = {
  id: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
};

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}

export function NewsletterForm({
  sponsorId,
  userId,
  compromisoId,
  initial,
  archivo,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  initial: NewsletterPayload | null;
  archivo: ArchivoActual | null;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [cuerpo, setCuerpo] = useState(initial?.cuerpo ?? "");
  const [cta, setCta] = useState(initial?.cta ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const palabras = countWords(cuerpo);
  const hasImage = Boolean(file) || Boolean(archivo && isStoredObject(archivo.storagePath));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (titulo.trim().length === 0 || titulo.length > MAX_TITULO) {
      setError(`El título debe tener entre 1 y ${MAX_TITULO} caracteres.`);
      return;
    }
    if (palabras === 0 || palabras > MAX_PALABRAS) {
      setError(`El cuerpo debe tener entre 1 y ${MAX_PALABRAS} palabras.`);
      return;
    }
    if (!cta.trim()) {
      setError("El link para el Call to Action es obligatorio.");
      return;
    }
    if (!hasImage) {
      setError("Sube una imagen PNG de 1080×1080 px.");
      return;
    }

    if (file) {
      const isPng =
        file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
      if (!isPng) {
        setError("La imagen debe ser formato PNG.");
        return;
      }
      try {
        const size = await readImageSize(file);
        if (size.width !== IMAGE_SIZE || size.height !== IMAGE_SIZE) {
          setError(`La imagen debe medir ${IMAGE_SIZE}×${IMAGE_SIZE} px.`);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Imagen inválida.");
        return;
      }
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const payload = JSON.stringify({
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      cta: cta.trim(),
    });

    let storagePath = archivo?.storagePath ?? "";
    if (file) {
      const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(ARCHIVOS_BUCKET)
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        setPending(false);
        return;
      }
      storagePath = path;
    }

    if (archivo) {
      const { error: updateError } = await supabase
        .from("archivos")
        .update({
          tipo: TIPO_NEWSLETTER,
          nombre_archivo: payload,
          storage_path: storagePath,
        })
        .eq("id", archivo.id)
        .eq("sponsor_id", sponsorId);
      if (updateError) {
        if (file) await supabase.storage.from(ARCHIVOS_BUCKET).remove([storagePath]);
        setError(updateError.message);
        setPending(false);
        return;
      }
      if (file && archivo.storagePath !== storagePath && isStoredObject(archivo.storagePath)) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([archivo.storagePath]);
      }
    } else {
      const { error: insertError } = await supabase.from("archivos").insert({
        sponsor_id: sponsorId,
        direccion: "sponsor_sube",
        tipo: TIPO_NEWSLETTER,
        nombre_archivo: payload,
        storage_path: storagePath,
        subido_por: userId,
        compromiso_id: compromisoId,
      });
      if (insertError) {
        if (file) await supabase.storage.from(ARCHIVOS_BUCKET).remove([storagePath]);
        setError(insertError.message);
        setPending(false);
        return;
      }
    }

    setFile(null);
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
    await removeStorageIfOrphan(supabase, archivo.storagePath);
    setTitulo("");
    setCuerpo("");
    setCta("");
    setFile(null);
    setPending(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="font-semibold">Contenido del newsletter</h2>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="newsletter-titulo">Título</Label>
            <span className="text-xs text-muted-foreground">
              {titulo.length}/{MAX_TITULO}
            </span>
          </div>
          <Input
            id="newsletter-titulo"
            value={titulo}
            maxLength={MAX_TITULO}
            onChange={(event) => setTitulo(event.target.value)}
            className="mt-1"
            required
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="newsletter-cuerpo">Cuerpo</Label>
            <span className="text-xs text-muted-foreground">
              {palabras}/{MAX_PALABRAS} palabras
            </span>
          </div>
          <Textarea
            id="newsletter-cuerpo"
            value={cuerpo}
            rows={5}
            className="mt-1"
            onChange={(event) => {
              const next = event.target.value;
              if (countWords(next) <= MAX_PALABRAS) setCuerpo(next);
            }}
            required
          />
        </div>

        <div>
          <Label htmlFor="newsletter-imagen">Imagen (1080×1080, PNG)</Label>
          {archivo?.viewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={archivo.viewUrl}
              alt="Imagen del newsletter"
              className="mt-2 max-h-48 rounded-lg border border-border object-contain"
            />
          ) : null}
          <Input
            id="newsletter-imagen"
            type="file"
            accept="image/png,.png"
            className="mt-2"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="mt-1 text-xs text-muted-foreground">{file.name}</p>
          ) : archivo ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Ya hay una imagen guardada. Sube otra para reemplazarla.
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="newsletter-cta">Link para el Call to Action</Label>
          <Input
            id="newsletter-cta"
            type="url"
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            className="mt-1"
            placeholder="https://…"
            required
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : archivo ? "Guardar cambios" : "Guardar newsletter"}
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
