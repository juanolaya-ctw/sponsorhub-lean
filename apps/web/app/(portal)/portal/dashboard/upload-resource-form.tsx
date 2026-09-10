"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "sponsorhub-archivos";

function safeFilename(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function UploadResourceForm({
  sponsorId,
  userId,
}: {
  sponsorId: string;
  userId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const file = form.get("archivo");
    const tipo = String(form.get("tipo") ?? "").trim();
    if (!(file instanceof File) || file.size === 0 || !tipo) {
      setError("Selecciona un archivo e indica su tipo.");
      setPending(false);
      return;
    }

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

    const { error: rowError } = await supabase.from("archivos").insert({
      sponsor_id: sponsorId,
      direccion: "sponsor_sube",
      tipo,
      nombre_archivo: file.name,
      storage_path: path,
      subido_por: userId,
    });

    if (rowError) {
      await supabase.storage.from(BUCKET).remove([path]);
      setError(rowError.message);
      setPending(false);
      return;
    }

    event.currentTarget.reset();
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_1fr_auto]">
      <div>
        <Label htmlFor="tipo">Tipo de insumo</Label>
        <Input id="tipo" name="tipo" required className="mt-1" placeholder="Logo, pieza, base de datos…" />
      </div>
      <div>
        <Label htmlFor="archivo">Archivo</Label>
        <Input id="archivo" name="archivo" type="file" required className="mt-1" />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Subiendo…" : "Subir archivo"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive sm:col-span-3">{error}</p> : null}
    </form>
  );
}
