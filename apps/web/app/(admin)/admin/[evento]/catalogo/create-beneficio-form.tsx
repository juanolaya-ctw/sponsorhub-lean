"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBeneficio, type CatalogoActionState } from "./actions";

const INITIAL: CatalogoActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Agregar beneficio"}
    </Button>
  );
}

export function CreateBeneficioForm({
  eventoId,
  slug,
}: {
  eventoId: string;
  slug: string;
}) {
  const [state, action] = useActionState(createBeneficio, INITIAL);

  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border border-border bg-white p-4 md:grid-cols-2"
    >
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="slug" value={slug} />

      <div>
        <Label htmlFor="tier">Tier</Label>
        <Input id="tier" name="tier" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="categoria">Categoría</Label>
        <Input id="categoria" name="categoria" required className="mt-1" />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="beneficio">Beneficio</Label>
        <Input id="beneficio" name="beneficio" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="cantidad">Cantidad</Label>
        <Input id="cantidad" name="cantidad" type="number" min={0} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" className="mt-1 min-h-20" />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive md:col-span-2">{state.error}</p>
      ) : null}
      <div className="flex justify-end md:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}
