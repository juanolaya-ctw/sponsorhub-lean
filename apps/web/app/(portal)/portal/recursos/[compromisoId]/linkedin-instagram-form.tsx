"use client";

import { FormEvent, useRef, useState } from "react";
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
  TIPO_LINKEDIN_INSTAGRAM,
  type LinkedInInstagramPayload,
} from "@/lib/portal/beneficios";

const MAX_PALABRAS = 80;

type ArchivoMeta = {
  id: string;
  nombre: string;
  storagePath: string;
};

type ImagenArchivo = {
  id: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
};

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
  imagenes,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  detalleSolicitud?: string | null;
  initial: LinkedInInstagramPayload | null;
  archivo: ArchivoMeta | null;
  imagenes: ImagenArchivo[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [datoImpactante, setDatoImpactante] = useState(
    initial?.dato_impactante ?? "",
  );
  const [parrafo1, setParrafo1] = useState(initial?.parrafo1 ?? "");
  const [parrafo2, setParrafo2] = useState(initial?.parrafo2 ?? "");
  const [parrafo3, setParrafo3] = useState(initial?.parrafo3 ?? "");
  const [pending, setPending] = useState(false);
  const [imagePending, setImagePending] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [optimisticImagenes, setOptimisticImagenes] = useState<ImagenArchivo[]>(
    [],
  );
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

  async function uploadImages(files: File[]) {
    const list = files.filter((file) => file.size > 0);
    if (list.length === 0) return;

    // Previews locales inmediatas para que el usuario vea que se cargaron.
    const localPreviews: ImagenArchivo[] = list.map((file, index) => ({
      id: `local-${Date.now()}-${index}`,
      nombre: file.name,
      storagePath: "",
      viewUrl: URL.createObjectURL(file),
    }));
    setOptimisticImagenes((prev) => [...prev, ...localPreviews]);

    setImagePending(true);
    setError(null);
    const supabase = createClient();

    for (const file of list) {
      const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(ARCHIVOS_BUCKET)
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) {
        for (const preview of localPreviews) {
          if (preview.viewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(preview.viewUrl);
          }
        }
        setOptimisticImagenes([]);
        setError(uploadError.message);
        setImagePending(false);
        return;
      }

      const { error: insertError } = await supabase.from("archivos").insert({
        sponsor_id: sponsorId,
        direccion: "sponsor_sube",
        tipo: TIPO_LINKEDIN_INSTAGRAM,
        nombre_archivo: file.name,
        storage_path: path,
        subido_por: userId,
        compromiso_id: compromisoId,
      });
      if (insertError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
        for (const preview of localPreviews) {
          if (preview.viewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(preview.viewUrl);
          }
        }
        setOptimisticImagenes([]);
        setError(insertError.message);
        setImagePending(false);
        return;
      }
    }

    for (const preview of localPreviews) {
      if (preview.viewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(preview.viewUrl);
      }
    }
    setOptimisticImagenes([]);
    setImagePending(false);
    router.refresh();
  }

  async function replaceImage(archivoId: string, file: File) {
    if (!file || file.size === 0) return;
    setImagePending(true);
    setError(null);
    const supabase = createClient();
    const current = imagenes.find((item) => item.id === archivoId);
    if (!current) {
      setImagePending(false);
      return;
    }

    const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(ARCHIVOS_BUCKET)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (uploadError) {
      setError(uploadError.message);
      setImagePending(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("archivos")
      .update({
        nombre_archivo: file.name,
        storage_path: path,
        tipo: TIPO_LINKEDIN_INSTAGRAM,
      })
      .eq("id", archivoId)
      .eq("sponsor_id", sponsorId);
    if (updateError) {
      await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
      setError(updateError.message);
      setImagePending(false);
      return;
    }

    await removeStorageIfOrphan(supabase, current.storagePath);
    setReplaceId(null);
    setImagePending(false);
    router.refresh();
  }

  async function removeImage(archivoId: string) {
    const current = imagenes.find((item) => item.id === archivoId);
    if (!current) return;
    setImagePending(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("archivos")
      .delete()
      .eq("id", archivoId)
      .eq("sponsor_id", sponsorId);
    if (deleteError) {
      setError(deleteError.message);
      setImagePending(false);
      return;
    }
    await removeStorageIfOrphan(supabase, current.storagePath);
    setImagePending(false);
    router.refresh();
  }

  async function removeMeta() {
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
          <Label>Imágenes del dato impactante</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Puedes subir varias imágenes, reemplazarlas o eliminarlas.
          </p>

          {(() => {
            const shown = [...imagenes, ...optimisticImagenes];
            if (shown.length === 0) return null;
            return (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {shown.map((imagen) => {
                  const isLocal = imagen.id.startsWith("local-");
                  return (
                    <li
                      key={imagen.id}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      {imagen.viewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagen.viewUrl}
                          alt={imagen.nombre}
                          className="h-40 w-full bg-muted/40 object-contain"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                          {imagen.nombre}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 border-t border-border p-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {imagen.nombre}
                          {isLocal ? " (subiendo…)" : ""}
                        </p>
                        {!isLocal ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={imagePending}
                              onClick={() => {
                                setReplaceId(imagen.id);
                                replaceInputRef.current?.click();
                              }}
                            >
                              Reemplazar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={imagePending}
                              onClick={() => void removeImage(imagen.id)}
                            >
                              Eliminar
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
            multiple
            className="hidden"
            onChange={(event) => {
              // FileList es live: hay que copiar ANTES de limpiar el input.
              const list = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (list.length > 0) void uploadImages(list);
            }}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (file && replaceId) void replaceImage(replaceId, file);
            }}
          />

          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              disabled={imagePending}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePending ? "Subiendo…" : "Subir imágenes"}
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="li-p1">Párrafo 1: Contexto del dato</Label>
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
            <Label htmlFor="li-p2">Párrafo 2: Impacto interno</Label>
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
              Párrafo 3: Mensaje al ecosistema (opcional)
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
              onClick={() => void removeMeta()}
            >
              Eliminar texto
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </section>
  );
}
