"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  finalizeBulkEntregaUpload,
  prepareBulkEntregaUpload,
  saveBulkEntregaLink,
} from "./bulk-entregables-actions";

const BUCKET = "sponsorhub-archivos";

type Sponsor = { id: string; nombre: string; paquete: string | null };

export function EntregablesBulkButton({
  sponsors,
  eventoSlug,
}: {
  sponsors: Sponsor[];
  eventoSlug: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<string>(ENTREGABLE_TIPOS[0]);
  const [mode, setMode] = useState<"archivo" | "link">("archivo");
  const [linkUrl, setLinkUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reset() {
    setError(null);
    setMode("archivo");
    setLinkUrl("");
    setSelected(new Set());
    setTipo(ENTREGABLE_TIPOS[0]);
  }

  function toggleSponsor(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sponsors.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sponsors.map((s) => s.id)));
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const prepared = await prepareBulkEntregaUpload(file.name);
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

    const result = await finalizeBulkEntregaUpload(
      Array.from(selected),
      eventoSlug,
      prepared.data.path,
      file.name,
      tipo,
    );
    setUploading(false);
    if (result.error) { setError(result.error); return; }
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">Subir entregable a varios sponsors</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subir entregable a varios sponsors</DialogTitle>
          <DialogDescription>
            El archivo o link quedará disponible en el portal de cada sponsor seleccionado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-tipo">Tipo de entregable</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="bulk-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTREGABLE_TIPOS.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setMode("archivo")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "archivo" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Archivo
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "link" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Link
            </button>
          </div>

          {mode === "link" ? (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-link">URL del recurso</Label>
              <Input
                id="bulk-link"
                type="url"
                placeholder="https://drive.google.com/…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Sponsors</Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {selected.size === sponsors.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {sponsors.map((sponsor) => (
                <label
                  key={sponsor.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.has(sponsor.id)}
                    onCheckedChange={() => toggleSponsor(sponsor.id)}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{sponsor.nombre}</span>
                    {sponsor.paquete ? (
                      <span className="ml-2 text-xs text-muted-foreground">{sponsor.paquete}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.size} de {sponsors.length} sponsors seleccionados
            </p>
          </div>

          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadFile(file);
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          {mode === "link" ? (
            <Button
              type="button"
              disabled={uploading || !linkUrl.trim() || selected.size === 0}
              onClick={() => {
                setUploading(true);
                setError(null);
                startTransition(async () => {
                  const result = await saveBulkEntregaLink(
                    Array.from(selected),
                    eventoSlug,
                    linkUrl.trim(),
                    tipo,
                  );
                  setUploading(false);
                  if (result.error) { setError(result.error); return; }
                  setOpen(false);
                  reset();
                  router.refresh();
                });
              }}
            >
              {uploading ? "Guardando…" : `Guardar link para ${selected.size} sponsor${selected.size !== 1 ? "s" : ""}`}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={uploading || selected.size === 0}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "Subiendo…" : `Elegir archivo para ${selected.size} sponsor${selected.size !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
