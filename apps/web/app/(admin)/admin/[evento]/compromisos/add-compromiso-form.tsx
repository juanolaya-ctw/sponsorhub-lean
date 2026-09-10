"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCompromiso,
  type CompromisoActionState,
} from "./actions";

type Option = { id: string; nombre: string };
const INITIAL: CompromisoActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Agregar compromiso"}
    </Button>
  );
}

export function AddCompromisoForm({
  eventoId,
  eventoSlug,
  sponsors,
  estados,
}: {
  eventoId: string;
  eventoSlug: string;
  sponsors: Option[];
  estados: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createCompromiso, INITIAL);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">Agregar compromiso</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar compromiso</DialogTitle>
          <DialogDescription>
            Asigna un beneficio y su estado inicial a un sponsor.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="evento_id" value={eventoId} />
          <input type="hidden" name="evento_slug" value={eventoSlug} />

          <div>
            <Label htmlFor="sponsor_id">Sponsor</Label>
            <select
              id="sponsor_id"
              name="sponsor_id"
              required
              defaultValue=""
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="" disabled>
                Selecciona un sponsor
              </option>
              {sponsors.map((sponsor) => (
                <option key={sponsor.id} value={sponsor.id}>
                  {sponsor.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="tipo">Tipo / beneficio</Label>
            <Input id="tipo" name="tipo" required className="mt-1" />
          </div>

          <div>
            <Label htmlFor="estado_id">Estado inicial</Label>
            <select
              id="estado_id"
              name="estado_id"
              required
              defaultValue=""
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="" disabled>
                Selecciona un estado
              </option>
              {estados.map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="fecha_limite">Fecha límite</Label>
            <Input id="fecha_limite" name="fecha_limite" type="date" className="mt-1" />
          </div>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
