"use client";

import { useState, useTransition } from "react";
import { updateSponsorCtMedia } from "./actions";

export function CtMediaToggle({
  sponsorId,
  eventoSlug,
  enabled,
}: {
  sponsorId: string;
  eventoSlug: string;
  enabled: boolean;
}) {
  const [value, setValue] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">CT Media</span>
        <select
          value={value ? "si" : "no"}
          disabled={pending}
          aria-label="Activar o desactivar CT Media para este sponsor"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
          onChange={(event) => {
            const previous = value;
            const next = event.target.value === "si";
            setValue(next);
            setError(null);
            startTransition(async () => {
              const result = await updateSponsorCtMedia(
                sponsorId,
                eventoSlug,
                next,
              );
              if (result.error) {
                setValue(previous);
                setError(result.error);
              }
            });
          }}
        >
          <option value="no">No</option>
          <option value="si">Sí — visible en portal</option>
        </select>
      </label>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Solo sponsors con CT Media = Sí ven el módulo de créditos. Los planes se
        gestionan en Media.
      </p>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
