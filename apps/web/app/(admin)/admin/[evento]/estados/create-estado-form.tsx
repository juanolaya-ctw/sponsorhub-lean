"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEstado, type EstadoActionState } from "./actions";

const INITIAL: EstadoActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Crear estado"}
    </Button>
  );
}

export function CreateEstadoForm({
  eventoId,
  slug,
}: {
  eventoId: string;
  slug: string;
}) {
  const [state, action] = useActionState(createEstado, INITIAL);

  return (
    <form action={action} className="grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="slug" value={slug} />

      <div className="lg:col-span-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" required className="mt-1" placeholder="En revisión legal" />
      </div>

      <div>
        <Label htmlFor="color">Color</Label>
        <Input id="color" name="color" type="color" defaultValue="#42B3F3" className="mt-1 h-8 p-1" />
      </div>

      <div>
        <Label htmlFor="orden">Orden</Label>
        <Input id="orden" name="orden" type="number" defaultValue={0} className="mt-1" />
      </div>

      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            name="es_estado_final"
            className="size-4 rounded border-input"
          />
          Estado final
        </label>
        <SubmitButton />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive sm:col-span-2 lg:col-span-5">{state.error}</p>
      ) : null}
    </form>
  );
}
