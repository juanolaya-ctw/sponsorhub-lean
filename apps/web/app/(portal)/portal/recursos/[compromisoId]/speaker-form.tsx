"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { TIPO_SPEAKER_FORM } from "@/lib/portal/beneficios";

const TALLY_URL = "https://tally.so/r/pbNMvy";

export function SpeakerForm({
  sponsorId,
  userId,
  compromisoId,
  completado,
  archivoId,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  completado: boolean;
  archivoId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(completado);

  async function toggle(checked: boolean) {
    const previous = done;
    setDone(checked);
    setPending(true);
    setError(null);
    const supabase = createClient();

    if (checked) {
      const { error: insertError } = await supabase.from("archivos").insert({
        sponsor_id: sponsorId,
        direccion: "sponsor_sube",
        tipo: TIPO_SPEAKER_FORM,
        nombre_archivo: "Formulario de speaker completado",
        storage_path: TIPO_SPEAKER_FORM,
        subido_por: userId,
        compromiso_id: compromisoId,
      });
      if (insertError) {
        setDone(previous);
        setError(insertError.message);
        setPending(false);
        return;
      }
    } else if (archivoId) {
      const { error: deleteError } = await supabase
        .from("archivos")
        .delete()
        .eq("id", archivoId)
        .eq("sponsor_id", sponsorId);
      if (deleteError) {
        setDone(previous);
        setError(deleteError.message);
        setPending(false);
        return;
      }
    }

    setPending(false);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5">
      <Button asChild className="h-10 px-4 text-sm">
        <a href={TALLY_URL} target="_blank" rel="noreferrer">
          Completar formulario de speaker
        </a>
      </Button>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
        <Checkbox
          id="speaker-completado"
          checked={done}
          disabled={pending}
          onCheckedChange={(value) => void toggle(value === true)}
        />
        <Label htmlFor="speaker-completado" className="cursor-pointer font-medium">
          Ya completé el formulario
        </Label>
      </div>
      {done ? (
        <p className="text-sm text-[#16a34a]">Formulario marcado como completado.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
