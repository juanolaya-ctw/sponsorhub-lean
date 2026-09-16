"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ARCHIVOS_BUCKET,
  safeFilename,
  TIPO_LOGO,
} from "@/lib/portal/beneficios";

type ArchivoActual = {
  id: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
  isImage: boolean;
};

export function BrandingForm({
  sponsorId,
  userId,
  compromisoId,
  archivo,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  archivo: ArchivoActual | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(ARCHIVOS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setPending(false);
      return;
    }

    if (archivo) {
      const { error: updateError } = await supabase
        .from("archivos")
        .update({
          nombre_archivo: file.name,
          storage_path: path,
          tipo: TIPO_LOGO,
        })
        .eq("id", archivo.id)
        .eq("sponsor_id", sponsorId);

      if (updateError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
        setError(updateError.message);
        setPending(false);
        return;
      }
      await supabase.storage.from(ARCHIVOS_BUCKET).remove([archivo.storagePath]);
    } else {
      const { error: insertError } = await supabase.from("archivos").insert({
        sponsor_id: sponsorId,
        direccion: "sponsor_sube",
        tipo: TIPO_LOGO,
        nombre_archivo: file.name,
        storage_path: path,
        subido_por: userId,
        compromiso_id: compromisoId,
      });
      if (insertError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
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
    await supabase.storage.from(ARCHIVOS_BUCKET).remove([archivo.storagePath]);
    setPending(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="font-semibold">Logo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sube el archivo en .ai o una imagen PNG de alta resolución.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".ai,.png,.svg,.jpg,.jpeg,.eps"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      {archivo ? (
        <div className="mt-4 space-y-4">
          {archivo.isImage && archivo.viewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={archivo.viewUrl}
              alt={archivo.nombre}
              className="max-h-48 rounded-lg border border-border object-contain"
            />
          ) : null}
          <p className="text-sm font-medium">{archivo.nombre}</p>
          <div className="flex flex-wrap gap-2">
            {archivo.viewUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={archivo.viewUrl} target="_blank" rel="noreferrer">
                  Ver
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Subiendo…" : "Reemplazar"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => void remove()}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Subiendo…" : "Subir archivo"}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
