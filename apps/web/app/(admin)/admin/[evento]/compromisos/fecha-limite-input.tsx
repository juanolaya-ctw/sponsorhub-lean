"use client";

import { useState, useTransition } from "react";
import { updateCompromisoFecha } from "./actions";

export function FechaLimiteInput({
  compromisoId,
  fechaLimite,
  eventoSlug,
}: {
  compromisoId: string;
  fechaLimite: string | null;
  eventoSlug: string;
}) {
  const [value, setValue] = useState(fechaLimite ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <input
        type="date"
        value={value}
        disabled={pending}
        aria-label="Fecha límite"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
        onChange={(event) => {
          const previous = value;
          const next = event.target.value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateCompromisoFecha(
              compromisoId,
              next,
              eventoSlug,
            );
            if (result.error) {
              setValue(previous);
              setError(result.error);
            }
          });
        }}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
