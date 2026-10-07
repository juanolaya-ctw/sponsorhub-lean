"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveFormularioLink,
  deleteFormularioLink,
} from "./actions";

export type FormularioPorSponsor = {
  id: string;
  url: string;
};

export function FormularioLinkPorSponsor({
  compromisoId,
  sponsorId,
  eventoSlug,
  nombreBeneficio,
  actual,
}: {
  compromisoId: string;
  sponsorId: string;
  eventoSlug: string;
  nombreBeneficio: string;
  actual: FormularioPorSponsor | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(actual?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveFormularioLink(
        compromisoId,
        sponsorId,
        eventoSlug,
        url.trim(),
        nombreBeneficio,
        actual?.id ?? null,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (!actual) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteFormularioLink(
        actual.id,
        sponsorId,
        eventoSlug,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSave} className="min-w-[220px] space-y-2">
      <Label htmlFor={`form-url-${compromisoId}`} className="text-xs">
        Link del formulario
      </Label>
      <Input
        id={`form-url-${compromisoId}`}
        type="url"
        placeholder="https://tally.so/r/…"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        className="h-8 text-sm"
        required
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : actual ? "Actualizar link" : "Guardar link"}
        </Button>
        {actual ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onDelete}
          >
            Quitar
          </Button>
        ) : null}
      </div>
      {actual ? (
        <a
          href={actual.url}
          target="_blank"
          rel="noreferrer"
          className="block max-w-[240px] truncate text-xs text-secondary hover:underline"
        >
          {actual.url}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          El sponsor verá este link en el portal.
        </p>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
