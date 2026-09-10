"use client";

import { useState, useTransition } from "react";
import { updateCompromisoEstado } from "./actions";

type EstadoOption = {
  id: string;
  nombre: string;
};

export function EstadoSelect({
  compromisoId,
  estadoId,
  eventoSlug,
  estados,
}: {
  compromisoId: string;
  estadoId: string | null;
  eventoSlug: string;
  estados: EstadoOption[];
}) {
  const [value, setValue] = useState(estadoId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <select
        value={value}
        disabled={pending}
        aria-label="Cambiar estado"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
        onChange={(event) => {
          const previous = value;
          const next = event.target.value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateCompromisoEstado(
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
      >
        <option value="" disabled>
          Sin estado
        </option>
        {estados.map((estado) => (
          <option key={estado.id} value={estado.id}>
            {estado.nombre}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 max-w-56 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
