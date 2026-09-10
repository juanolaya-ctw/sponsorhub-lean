"use client";

import { useState, useTransition } from "react";
import { updateSponsorTier } from "./actions";

export function TierSelect({
  sponsorId,
  eventoSlug,
  currentTier,
  tiers,
}: {
  sponsorId: string;
  eventoSlug: string;
  currentTier: string | null;
  tiers: string[];
}) {
  const [value, setValue] = useState(currentTier ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const currentMissing = Boolean(currentTier && !tiers.includes(currentTier));

  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Tier</span>
        <select
          value={value}
          disabled={pending || tiers.length === 0}
          aria-label="Cambiar tier del sponsor"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
          onChange={(event) => {
            const previous = value;
            const next = event.target.value;
            setValue(next);
            setError(null);
            startTransition(async () => {
              const result = await updateSponsorTier(
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
          {tiers.length === 0 ? (
            <option value="">Sin tiers en el catálogo</option>
          ) : null}
          {currentMissing && currentTier ? (
            <option value={currentTier}>{currentTier} (actual)</option>
          ) : null}
          {tiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
