"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteBeneficioFormulario,
  upsertBeneficioFormulario,
} from "./actions";

export type FormularioEventoRow = {
  beneficioNombre: string;
  sponsorsCount: number;
  url: string | null;
};

function FormularioRow({
  row,
  eventoId,
  eventoSlug,
}: {
  row: FormularioEventoRow;
  eventoId: string;
  eventoSlug: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(row.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await upsertBeneficioFormulario(
        eventoId,
        eventoSlug,
        row.beneficioNombre,
        url.trim(),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBeneficioFormulario(
        eventoId,
        eventoSlug,
        row.beneficioNombre,
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
    <li className="border-b border-border px-4 py-4 last:border-b-0">
      <form onSubmit={onSave} className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">{row.beneficioNombre}</p>
          <p className="text-xs text-muted-foreground">
            {row.sponsorsCount}{" "}
            {row.sponsorsCount === 1 ? "sponsor" : "sponsors"}
          </p>
        </div>
        <Label htmlFor={`form-global-${row.beneficioNombre}`} className="sr-only">
          Link del formulario
        </Label>
        <Input
          id={`form-global-${row.beneficioNombre}`}
          type="url"
          placeholder="https://tally.so/r/…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Guardando…" : row.url ? "Actualizar link" : "Guardar link"}
          </Button>
          {row.url ? (
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
        {row.url ? (
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-secondary hover:underline"
          >
            {row.url}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            Un solo link para todos los sponsors con este beneficio.
          </p>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </form>
    </li>
  );
}

export function FormulariosEventoSection({
  eventoId,
  eventoSlug,
  rows,
}: {
  eventoId: string;
  eventoSlug: string;
  rows: FormularioEventoRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
        <p className="font-medium">No hay beneficios de speaking / moderación</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando existan compromisos como Speaking Slot o Moderación de Policy
          Lab, podrás pegar aquí el formulario una sola vez.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white">
      <ul>
        {rows.map((row) => (
          <FormularioRow
            key={row.beneficioNombre}
            row={row}
            eventoId={eventoId}
            eventoSlug={eventoSlug}
          />
        ))}
      </ul>
    </div>
  );
}
