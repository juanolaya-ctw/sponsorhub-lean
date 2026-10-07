"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { TIPO_SPEAKER_FORM } from "@/lib/portal/beneficios";

const DISCLAIMER =
  "Al abrir y completar este formulario aceptas que ColombiaTech use la información que envíes para tu acreditación, inclusión en la agenda y comunicaciones operativas del evento. No compartiremos tus datos con terceros ajenos a la producción del evento sin tu consentimiento.";

export function SpeakerForm({
  sponsorId,
  userId,
  compromisoId,
  beneficioNombre,
  formularioUrl,
  completado,
  archivoId,
}: {
  sponsorId: string;
  userId: string;
  compromisoId: string;
  beneficioNombre: string;
  formularioUrl: string | null;
  completado: boolean;
  archivoId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(completado);
  const [aceptaDisclaimer, setAceptaDisclaimer] = useState(completado);

  async function toggle(checked: boolean) {
    if (checked && !aceptaDisclaimer) {
      setError("Debes aceptar el disclaimer antes de marcar como completado.");
      return;
    }

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
        nombre_archivo: `Formulario completado: ${beneficioNombre}`,
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
      <h2 className="font-semibold">Formulario de {beneficioNombre}</h2>

      <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Disclaimer</p>
        <p className="mt-1">{DISCLAIMER}</p>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="speaker-disclaimer"
          checked={aceptaDisclaimer}
          disabled={pending || done}
          onCheckedChange={(value) => {
            setAceptaDisclaimer(value === true);
            setError(null);
          }}
        />
        <Label
          htmlFor="speaker-disclaimer"
          className="cursor-pointer text-sm font-normal leading-snug"
        >
          He leído y acepto el disclaimer
        </Label>
      </div>

      {formularioUrl ? (
        <Button asChild className="h-10 px-4 text-sm" disabled={!aceptaDisclaimer}>
          <a
            href={formularioUrl}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!aceptaDisclaimer}
            className={!aceptaDisclaimer ? "pointer-events-none opacity-50" : undefined}
            onClick={(event) => {
              if (!aceptaDisclaimer) {
                event.preventDefault();
                setError("Acepta el disclaimer para abrir el formulario.");
              }
            }}
          >
            Completar formulario
          </a>
        </Button>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          ColombiaTech aún no ha publicado el link del formulario para este
          beneficio. Te avisaremos cuando esté disponible.
        </p>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
        <Checkbox
          id="speaker-completado"
          checked={done}
          disabled={pending || (!done && !formularioUrl)}
          onCheckedChange={(value) => void toggle(value === true)}
        />
        <Label htmlFor="speaker-completado" className="cursor-pointer font-medium">
          Ya completé el formulario
        </Label>
      </div>
      {done ? (
        <p className="text-sm text-[#16a34a]">
          Formulario marcado como completado. Este beneficio cuenta en tu
          progreso.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
