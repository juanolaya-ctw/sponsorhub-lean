"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  deleteArchivo,
  finalizeReplacement,
  prepareReplacementUpload,
} from "./actions";

const BUCKET = "sponsorhub-archivos";

export function ArchivoActions({
  archivoId,
  sponsorId,
  eventoSlug,
  nombre,
  storagePath,
  viewUrl,
  downloadUrl,
  realFile,
}: {
  archivoId: string;
  sponsorId: string;
  eventoSlug: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
  downloadUrl: string | null;
  realFile: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const externalUrl = /^https?:\/\//i.test(storagePath) ? storagePath : null;

  async function replaceFile(file: File) {
    setReplacing(true);
    setError(null);

    const prepared = await prepareReplacementUpload(
      archivoId,
      sponsorId,
      file.name,
    );
    if (!prepared.data || prepared.error) {
      setError(prepared.error ?? "No se pudo preparar la subida.");
      setReplacing(false);
      return;
    }

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
        contentType: file.type || undefined,
      });
    if (uploadError) {
      setError(uploadError.message);
      setReplacing(false);
      return;
    }

    const result = await finalizeReplacement(
      archivoId,
      sponsorId,
      eventoSlug,
      prepared.data.path,
      file.name,
    );
    setError(result.error);
    setReplacing(false);
    if (!result.error) router.refresh();
  }

  const viewControl = viewUrl || externalUrl ? (
    <Button asChild variant="outline" size="sm">
      <a href={viewUrl ?? externalUrl ?? "#"} target="_blank" rel="noreferrer">
        Ver
      </a>
    </Button>
  ) : (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Ver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contenido del insumo</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-foreground">
            {nombre}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <div className="flex items-center gap-4">
        {viewControl}

        {realFile ? (
          <>
            <Button asChild variant="outline" size="sm">
              <a href={downloadUrl ?? viewUrl ?? "#"} download={nombre}>
                Descargar
              </a>
            </Button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void replaceFile(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={replacing}
              onClick={() => fileInput.current?.click()}
            >
              {replacing ? "Reemplazando…" : "Reemplazar"}
            </Button>
          </>
        ) : null}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm">
              Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar archivo</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar este archivo? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await deleteArchivo(
                      archivoId,
                      sponsorId,
                      eventoSlug,
                    );
                    setError(result.error);
                    if (!result.error) router.refresh();
                  });
                }}
              >
                {pending ? "Eliminando…" : "Confirmar eliminación"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
