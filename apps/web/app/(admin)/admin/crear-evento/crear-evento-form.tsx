"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/admin/slugify";
import { createEvento, type CrearEventoState } from "./actions";

const INITIAL: CrearEventoState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creando…" : "Crear evento"}
    </Button>
  );
}

export function CrearEventoForm() {
  const [state, action] = useActionState(createEvento, INITIAL);
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);

  return (
    <form action={action} className="mt-8 max-w-lg space-y-4 rounded-xl border border-border bg-white p-6">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          value={nombre}
          className="mt-1"
          placeholder="Colombia Tech Week 2027"
          onChange={(event) => {
            const next = event.target.value;
            setNombre(next);
            if (!slugManual) setSlug(slugify(next));
          }}
        />
      </div>

      <div>
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          className="mt-1"
          placeholder="ctw-2027"
          onChange={(event) => {
            setSlugManual(true);
            setSlug(slugify(event.target.value));
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Se genera desde el nombre. Puedes editarlo antes de guardar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fecha_inicio">Fecha inicio</Label>
          <Input id="fecha_inicio" name="fecha_inicio" type="date" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="fecha_fin">Fecha fin</Label>
          <Input id="fecha_fin" name="fecha_fin" type="date" className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="estado">Estado</Label>
        <select
          id="estado"
          name="estado"
          defaultValue="planificacion"
          className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="planificacion">Planificación</option>
          <option value="activo">Activo</option>
          <option value="cerrado">Cerrado</option>
        </select>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
