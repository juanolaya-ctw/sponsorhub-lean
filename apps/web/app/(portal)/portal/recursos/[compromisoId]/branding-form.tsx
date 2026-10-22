"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ARCHIVOS_BUCKET,
  isStoredObject,
  safeFilename,
  TIPO_LOGO,
} from "@/lib/portal/beneficios";
import { CargadoBadge } from "../cargado-badge";

type ArchivoActual = {
  id: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
  isImage: boolean;
};

async function removeStorageIfOrphan(
  supabase: ReturnType<typeof createClient>,
  path: string,
) {
  const { count } = await supabase
    .from("archivos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", path);
  if (!count && isStoredObject(path)) {
    await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
  }
}

function LogoPreview({ archivo }: { archivo: ArchivoActual }) {
  if (archivo.isImage && archivo.viewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={archivo.viewUrl}
        alt={archivo.nombre}
        className="max-h-48 rounded-lg border border-border object-contain"
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
      <FileIcon className="size-8 text-muted-foreground" aria-hidden />
      <p className="truncate text-sm font-medium">{archivo.nombre}</p>
    </div>
  );
}

export function BrandingForm({
  sponsorId,
  userId,
  compromisoId,
  archivo,
  logoCompartido,
  adicionales,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  archivo: ArchivoActual | null;
  logoCompartido: ArchivoActual | null;
  /** Otros archivos de logo del beneficio (p. ej. el PNG junto al .ai). */
  adicionales: ArchivoActual[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const soloAnadirRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrirSelector(soloAnadir: boolean) {
    soloAnadirRef.current = soloAnadir;
    inputRef.current?.click();
  }

  async function uploadOne(file: File, replace: ArchivoActual | null) {
    const supabase = createClient();
    const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(ARCHIVOS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) return uploadError.message;

    if (replace) {
      const previousPath = replace.storagePath;
      const { error: updateError } = await supabase
        .from("archivos")
        .update({
          nombre_archivo: file.name,
          storage_path: path,
          tipo: TIPO_LOGO,
        })
        .eq("id", replace.id)
        .eq("sponsor_id", sponsorId);
      if (updateError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
        return updateError.message;
      }
      await removeStorageIfOrphan(supabase, previousPath);
      return null;
    }

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
      return insertError.message;
    }
    return null;
  }

  /** El primer archivo reemplaza al actual (si hay y no es "añadir"); los demás se suman. */
  async function upload(files: File[], soloAnadir: boolean) {
    setPending(true);
    setError(null);
    for (const [index, file] of files.entries()) {
      const message = await uploadOne(file, index === 0 && !soloAnadir ? archivo : null);
      if (message) {
        setError(`${file.name}: ${message}`);
        break;
      }
    }
    setPending(false);
    router.refresh();
  }

  async function usarLogoCompartido() {
    if (!logoCompartido) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("archivos").insert({
      sponsor_id: sponsorId,
      direccion: "sponsor_sube",
      tipo: TIPO_LOGO,
      nombre_archivo: logoCompartido.nombre,
      storage_path: logoCompartido.storagePath,
      subido_por: userId,
      compromiso_id: compromisoId,
    });
    if (insertError) {
      setError(insertError.message);
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  async function remove(target: ArchivoActual | null = archivo ?? logoCompartido) {
    if (!target) return;
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("archivos")
      .delete()
      .eq("sponsor_id", sponsorId)
      .eq("storage_path", target.storagePath);
    if (deleteError) {
      setError(deleteError.message);
      setPending(false);
      return;
    }
    await removeStorageIfOrphan(supabase, target.storagePath);
    setPending(false);
    router.refresh();
  }

  const mostrarCompartido = !archivo && logoCompartido;

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Logo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mostrarCompartido
              ? "Ya subiste un logo en otro beneficio. Puedes reutilizarlo o cargar uno distinto."
              : "Sube el archivo en .ai o una imagen PNG de alta resolución."}
          </p>
          <p className="mt-2 rounded-lg bg-[#42B3F3]/10 px-3 py-2 text-sm">
            Ojalá subas el editable (<strong>.ai</strong>) y también un{" "}
            <strong>.png</strong>. Puedes seleccionar varios archivos a la
            vez. El PNG se usa para armar tu pieza «Soy Sponsor».
          </p>
        </div>
        {archivo || mostrarCompartido ? <CargadoBadge /> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".ai,.png,.svg,.jpg,.jpeg,.eps"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void upload(files, soloAnadirRef.current);
        }}
      />

      {archivo ? (
        <div className="mt-4 space-y-4">
          <LogoPreview archivo={archivo} />
          {archivo.isImage ? (
            <p className="text-sm font-medium">{archivo.nombre}</p>
          ) : null}
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
              onClick={() => abrirSelector(false)}
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
      ) : mostrarCompartido && logoCompartido ? (
        <div className="mt-4 space-y-4">
          <LogoPreview archivo={logoCompartido} />
          {logoCompartido.isImage ? (
            <p className="text-sm font-medium">{logoCompartido.nombre}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => void usarLogoCompartido()}
            >
              {pending ? "Guardando…" : "Usar este logo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => abrirSelector(false)}
            >
              Subir uno diferente
            </Button>
            <Button
              type="button"
              variant="destructive"
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
            onClick={() => abrirSelector(false)}
          >
            {pending ? "Subiendo…" : "Subir archivo"}
          </Button>
        </div>
      )}

      {adicionales.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {adicionales.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{item.nombre}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                {item.viewUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={item.viewUrl} target="_blank" rel="noreferrer">
                      Ver
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => void remove(item)}
                >
                  Eliminar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {archivo || mostrarCompartido ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => abrirSelector(true)}
          >
            {pending ? "Subiendo…" : "Añadir más archivos"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
