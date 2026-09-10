"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { InsumoRequerido } from "@/lib/portal/insumos";

const BUCKET = "sponsorhub-archivos";

function safeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function InsumosUploader({
  sponsorId,
  userId,
  insumos,
  subidos,
}: {
  sponsorId: string;
  userId: string;
  insumos: InsumoRequerido[];
  subidos: string[];
}) {
  const router = useRouter();
  const subidosSet = new Set(subidos);

  return (
    <ul className="divide-y divide-border">
      {insumos.map((insumo) => (
        <InsumoRow
          key={insumo.key}
          insumo={insumo}
          sponsorId={sponsorId}
          userId={userId}
          subido={subidosSet.has(insumo.key)}
          onSaved={() => router.refresh()}
        />
      ))}
    </ul>
  );
}

function InsumoRow({
  insumo,
  sponsorId,
  userId,
  subido,
  onSaved,
}: {
  insumo: InsumoRequerido;
  sponsorId: string;
  userId: string;
  subido: boolean;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);

  async function insertRow(nombreArchivo: string, storagePath: string) {
    const supabase = createClient();
    return supabase.from("archivos").insert({
      sponsor_id: sponsorId,
      direccion: "sponsor_sube",
      tipo: insumo.key,
      nombre_archivo: nombreArchivo,
      storage_path: storagePath,
      subido_por: userId,
    });
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || file.size === 0) return;

    setPending(true);
    setError(null);

    const supabase = createClient();
    const path = `${sponsorId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setPending(false);
      return;
    }

    const { error: rowError } = await insertRow(file.name, path);
    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setError(rowError.message);
      setPending(false);
      return;
    }

    setPending(false);
    onSaved();
  }

  async function handleTextoLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const texto = String(form.get("texto") ?? "").trim();
    const link = String(form.get("link") ?? "").trim();

    if (!texto) {
      setError("Escribe el texto del insumo.");
      return;
    }

    setPending(true);
    setError(null);
    const { error: rowError } = await insertRow(texto, link || "(sin enlace)");
    if (rowError) {
      setError(rowError.message);
      setPending(false);
      return;
    }
    setPending(false);
    setOpenForm(false);
    onSaved();
  }

  async function handleTexto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nombre = String(form.get("nombre") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const telefono = String(form.get("telefono") ?? "").trim();

    if (!nombre || !email) {
      setError("Nombre y email son obligatorios.");
      return;
    }

    setPending(true);
    setError(null);
    const resumen = `${nombre} · ${email}${telefono ? ` · ${telefono}` : ""}`;
    const { error: rowError } = await insertRow(resumen, "texto");
    if (rowError) {
      setError(rowError.message);
      setPending(false);
      return;
    }
    setPending(false);
    setOpenForm(false);
    onSaved();
  }

  const estado = subido ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#16a34a]">
      <CheckCircle2 className="size-4" />
      Subido
    </span>
  ) : (
    <span className="text-sm text-muted-foreground">Pendiente</span>
  );

  return (
    <li className="py-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{insumo.nombre}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{insumo.descripcion}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {estado}

          {insumo.tipo === "archivo" ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleFile(event)}
              />
              <Button
                type="button"
                variant={subido ? "outline" : "default"}
                size="sm"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                {pending ? "Subiendo…" : subido ? "Reemplazar" : "Subir"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant={subido ? "outline" : "default"}
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                setOpenForm((value) => !value);
              }}
            >
              {openForm ? "Cancelar" : subido ? "Editar" : "Completar"}
            </Button>
          )}
        </div>
      </div>

      {openForm && insumo.tipo === "texto+link" ? (
        <form
          onSubmit={(event) => void handleTextoLink(event)}
          className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/30 p-4"
        >
          <div>
            <Label htmlFor={`${insumo.key}-texto`}>Texto</Label>
            <Textarea
              id={`${insumo.key}-texto`}
              name="texto"
              required
              rows={3}
              className="mt-1"
              placeholder="Contenido que quieres que publiquemos…"
            />
          </div>
          <div>
            <Label htmlFor={`${insumo.key}-link`}>Enlace de referencia</Label>
            <Input
              id={`${insumo.key}-link`}
              name="link"
              type="url"
              className="mt-1"
              placeholder="https://…"
            />
          </div>
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      ) : null}

      {openForm && insumo.tipo === "texto" ? (
        <form
          onSubmit={(event) => void handleTexto(event)}
          className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3"
        >
          <div>
            <Label htmlFor={`${insumo.key}-nombre`}>Nombre</Label>
            <Input id={`${insumo.key}-nombre`} name="nombre" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor={`${insumo.key}-email`}>Email</Label>
            <Input
              id={`${insumo.key}-email`}
              name="email"
              type="email"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`${insumo.key}-telefono`}>Teléfono</Label>
            <Input id={`${insumo.key}-telefono`} name="telefono" className="mt-1" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </li>
  );
}
