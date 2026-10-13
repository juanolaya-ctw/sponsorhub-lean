"use client";

import { useState, useTransition } from "react";
import {
  resolverTipoAcceso,
  tipoFormulario,
} from "@/lib/portal/beneficios";
import { updateCompromisoAccesoTipo } from "../../compromisos/actions";

function AccesoTipoSelectInner({
  compromisoId,
  beneficioNombre,
  accesoTipo,
  eventoSlug,
}: {
  compromisoId: string;
  beneficioNombre: string;
  accesoTipo: string | null;
  eventoSlug: string;
}) {
  const inferred = resolverTipoAcceso({
    accesoTipo,
    beneficioNombre,
  });
  const [value, setValue] = useState<"vip" | "general">(inferred);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-1">
      <select
        value={value}
        disabled={pending}
        aria-label={`Tipo de acceso de ${beneficioNombre}`}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs capitalize disabled:opacity-60"
        onChange={(event) => {
          const next = event.target.value as "vip" | "general";
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateCompromisoAccesoTipo(
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
        <option value="general">Acceso general</option>
        <option value="vip">Acceso VIP</option>
      </select>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function AccesoTipoSelect(props: {
  compromisoId: string;
  beneficioNombre: string;
  accesoTipo: string | null;
  eventoSlug: string;
}) {
  if (tipoFormulario(props.beneficioNombre) !== "accesos") return null;
  return <AccesoTipoSelectInner {...props} />;
}
