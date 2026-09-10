"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          onUploaded={() => router.refresh()}
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
  onUploaded,
}: {
  insumo: InsumoRequerido;
  sponsorId: string;
  userId: string;
  subido: boolean;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const { error: rowError } = await supabase.from("archivos").insert({
      sponsor_id: sponsorId,
      direccion: "sponsor_sube",
      tipo: insumo.key,
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

    setPending(false);
    onUploaded();
  }

  return (
    <li className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{insumo.nombre}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{insumo.descripcion}</p>
        {error ? (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {subido ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#16a34a]">
            <CheckCircle2 className="size-4" />
            Subido
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Pendiente</span>
        )}
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
      </div>
    </li>
  );
}
