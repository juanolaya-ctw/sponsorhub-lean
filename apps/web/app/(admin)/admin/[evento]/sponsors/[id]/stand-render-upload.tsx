"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ARCHIVOS_BUCKET,
  isImageName,
  isStoredObject,
  safeFilename,
  TIPO_STAND_RENDER,
  type StandRevision,
} from "@/lib/portal/beneficios";

export type StandRenderArchivo = {
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

export function StandRenderUpload({
  compromisoId,
  sponsorId,
  renders,
  revision,
}: {
  compromisoId: string;
  sponsorId: string;
  renders: StandRenderArchivo[];
  revision: StandRevision | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadFiles(files: File[]) {
    const list = files.filter((file) => file.size > 0);
    if (list.length === 0) {
      setError("No se seleccionó ningún archivo válido.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sesión no válida. Vuelve a iniciar sesión.");
        return;
      }

      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        const path = `${sponsorId}/admin/${Date.now()}_${i}_${safeFilename(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(ARCHIVOS_BUCKET)
          .upload(path, file, {
            contentType: file.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          setError(uploadError.message);
          return;
        }

        const { error: insertError } = await supabase.from("archivos").insert({
          compromiso_id: compromisoId,
          sponsor_id: sponsorId,
          nombre_archivo: file.name,
          storage_path: path,
          direccion: "admin_sube_por_sponsor",
          tipo: TIPO_STAND_RENDER,
          subido_por: user.id,
        });

        if (insertError) {
          await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
          setError(insertError.message);
          return;
        }
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir renders.");
    } finally {
      setUploading(false);
    }
  }

  async function removeRender(archivo: StandRenderArchivo) {
    setDeletingId(archivo.id);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("archivos")
      .delete()
      .eq("id", archivo.id)
      .eq("sponsor_id", sponsorId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    await removeStorageIfOrphan(supabase, archivo.storagePath);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="flex max-w-xs flex-col items-start gap-1.5">
      {revision ? (
        <div
          className={
            revision.decision === "aprobado"
              ? "rounded-md border border-emerald-600/30 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900"
              : "rounded-md border border-amber-600/30 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
          }
        >
          <p className="font-medium">
            {revision.decision === "aprobado"
              ? "Stand aprobado"
              : "Cambios solicitados"}
          </p>
          {revision.comentario ? (
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">
              {revision.comentario}
            </p>
          ) : null}
        </div>
      ) : renders.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Renders cargados · pendiente de aprobación del sponsor
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Sin renders aún</p>
      )}

      {renders.length > 0 ? (
        <ul className="grid grid-cols-2 gap-1.5">
          {renders.map((archivo) => (
            <li
              key={archivo.id}
              className="group relative overflow-hidden rounded-md border border-border bg-muted/40"
            >
              {archivo.viewUrl && isImageName(archivo.nombre) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={archivo.viewUrl}
                  alt={archivo.nombre}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                  {archivo.nombre}
                </div>
              )}
              <button
                type="button"
                disabled={deletingId === archivo.id}
                onClick={() => void removeRender(archivo)}
                className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
                aria-label={`Eliminar ${archivo.nombre}`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          // Copiar antes de limpiar: FileList es live y se vacía al resetear value.
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void uploadFiles(files);
        }}
      />

      <Button
        type="button"
        variant={renders.length > 0 ? "outline" : "default"}
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload data-icon="inline-start" />
        {uploading
          ? "Subiendo…"
          : renders.length > 0
            ? "Agregar renders"
            : "Subir renders"}
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
