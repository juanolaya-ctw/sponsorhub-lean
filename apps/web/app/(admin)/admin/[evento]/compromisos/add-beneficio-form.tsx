"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createBeneficio,
  type BeneficioActionState,
} from "./actions";

const INITIAL: BeneficioActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Guardando…" : "Guardar beneficio"}
    </Button>
  );
}

export function AddBeneficioForm({
  eventoId,
  eventoSlug,
  tier,
}: {
  eventoId: string;
  eventoSlug: string;
  tier: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createBeneficio, INITIAL);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Agregar beneficio
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2"
    >
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="evento_slug" value={eventoSlug} />
      <input type="hidden" name="tier" value={tier} />

      <div>
        <Label htmlFor={`${tier}-categoria`}>Categoría</Label>
        <Input id={`${tier}-categoria`} name="categoria" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor={`${tier}-cantidad`}>Cantidad</Label>
        <Input
          id={`${tier}-cantidad`}
          name="cantidad"
          type="number"
          min={0}
          className="mt-1"
        />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor={`${tier}-beneficio`}>Beneficio</Label>
        <Input id={`${tier}-beneficio`} name="beneficio" required className="mt-1" />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor={`${tier}-notas`}>Notas</Label>
        <Textarea id={`${tier}-notas`} name="notas" className="mt-1 min-h-20" />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive md:col-span-2">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
