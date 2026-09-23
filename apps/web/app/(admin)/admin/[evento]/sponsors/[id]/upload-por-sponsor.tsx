"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ARCHIVOS_BUCKET,
  isStoredObject,
  safeFilename,
  tipoFormulario,
  TIPO_LINKEDIN_INSTAGRAM,
  TIPO_LOGO,
  TIPO_NEWSLETTER,
  TIPO_SPEAKER_FORM,
} from "@/lib/portal/beneficios";

export type ArchivoPorSponsor = {
  id: string;
  nombre: string;
  storagePath: string;
};

function tipoDesdeBeneficio(nombreBeneficio: string): string {
  const tipo = tipoFormulario(nombreBeneficio);
  if (tipo === "branding") return TIPO_LOGO;
  if (tipo === "newsletter") return TIPO_NEWSLETTER;
  if (tipo === "linkedin_instagram") return TIPO_LINKEDIN_INSTAGRAM;
  if (tipo === "speaker") return TIPO_SPEAKER_FORM;
  return "archivo";
}

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

export function UploadPorSponsor({
  compromisoId,
  sponsorId,
  nombreBeneficio,
  archivoActual,
}: {
  compromisoId: string;
  sponsorId: string;
  nombreBeneficio: string;
  archivoActual: ArchivoPorSponsor | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const shownName = successName ?? archivoActual?.nombre ?? null;
  const hasFile = Boolean(archivoActual) || Boolean(successName);

  async function upload(file: File) {
    if (!file || file.size === 0) return;

    setUploading(true);
    setError(null);
    setSuccessName(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión no válida. Vuelve a iniciar sesión.");
      setUploading(false);
      return;
    }

    const path = `${sponsorId}/admin/${Date.now()}_${safeFilename(file.name)}`;
    const tipo = tipoDesdeBeneficio(nombreBeneficio);

    const { error: uploadError } = await supabase.storage
      .from(ARCHIVOS_BUCKET)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    if (archivoActual) {
      const previousPath = archivoActual.storagePath;
      const { error: updateError } = await supabase
        .from("archivos")
        .update({
          nombre_archivo: file.name,
          storage_path: path,
          direccion: "admin_sube_por_sponsor",
          tipo,
          subido_por: user.id,
        })
        .eq("id", archivoActual.id)
        .eq("sponsor_id", sponsorId);

      if (updateError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
        setError(updateError.message);
        setUploading(false);
        return;
      }

      if (previousPath !== path) {
        await removeStorageIfOrphan(supabase, previousPath);
      }
    } else {
      const { error: insertError } = await supabase.from("archivos").insert({
        compromiso_id: compromisoId,
        sponsor_id: sponsorId,
        nombre_archivo: file.name,
        storage_path: path,
        direccion: "admin_sube_por_sponsor",
        tipo,
        subido_por: user.id,
      });

      if (insertError) {
        await supabase.storage.from(ARCHIVOS_BUCKET).remove([path]);
        setError(insertError.message);
        setUploading(false);
        return;
      }
    }

    setSuccessName(file.name);
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {hasFile ? (
          <span
            className="max-w-[160px] truncate rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
            title={shownName ?? undefined}
          >
            Archivo subido
            {shownName ? `: ${shownName}` : ""}
          </span>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />

        <Button
          type="button"
          variant={hasFile ? "outline" : "default"}
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          aria-label={
            hasFile
              ? `Reemplazar archivo de ${nombreBeneficio}`
              : `Subir archivo para ${nombreBeneficio}`
          }
        >
          <Upload data-icon="inline-start" />
          {uploading ? "Subiendo…" : hasFile ? "Reemplazar" : "Subir archivo"}
        </Button>
      </div>

      {error ? <p className="max-w-56 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
