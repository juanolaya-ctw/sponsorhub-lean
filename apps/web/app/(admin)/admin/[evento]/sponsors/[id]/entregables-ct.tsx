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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ENTREGABLE_TIPOS } from "@/lib/portal/beneficios";
import {
  deleteArchivo,
  finalizeEntregaUpload,
  prepareEntregaUpload,
} from "./actions";

const BUCKET = "sponsorhub-archivos";

type EntregaItem = {
  id: string;
  tipo: string;
  nombre: string;
  storagePath: string;
  createdAt: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

export function EntregablesCtSection({
  sponsorId,
  eventoSlug,
  archivos,
}: {
  sponsorId: string;
  eventoSlug: string;
  archivos: EntregaItem[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>(ENTREGABLE_TIPOS[0]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const prepared = await prepareEntregaUpload(sponsorId, file.name);
    if (!prepared.data || prepared.error) {
      setError(prepared.error ?? "No se pudo preparar la subida.");
      setUploading(false);
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
      setUploading(false);
      return;
    }

    const result = await finalizeEntregaUpload(
      sponsorId,
      eventoSlug,
      prepared.data.path,
      file.name,
      tipo,
    );
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Entregables de ColombiaTech</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archivos que el equipo comparte con este sponsor (deck, toolkit,
            manual de marca).
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button type="button">Subir entregable</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Subir entregable</DialogTitle>
              <DialogDescription>
                El archivo quedará disponible en el portal del sponsor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="entrega-tipo">Tipo de entregable</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="entrega-tipo" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTREGABLE_TIPOS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file);
                }}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? "Subiendo…" : "Elegir archivo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {archivos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-medium">Aún no hay entregables para este sponsor</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-white">
          {archivos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{archivo.nombre}</p>
                <p className="text-xs text-muted-foreground">{archivo.tipo}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {archivo.viewUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={archivo.viewUrl} target="_blank" rel="noreferrer">
                      Ver
                    </a>
                  </Button>
                ) : null}
                {archivo.downloadUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={archivo.downloadUrl} download={archivo.nombre}>
                      Descargar
                    </a>
                  </Button>
                ) : null}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm">
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar entregable</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Eliminar {archivo.nombre}? Esta acción no se puede
                        deshacer.
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
                              archivo.id,
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
