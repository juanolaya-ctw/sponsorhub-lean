"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resolverAlerta } from "./actions";

export function ResolverAlertaButton({ id, slug }: { id: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await resolverAlerta(id, slug);
            setError(result.error);
          });
        }}
      >
        {pending ? "Resolviendo…" : "Marcar como resuelta"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
