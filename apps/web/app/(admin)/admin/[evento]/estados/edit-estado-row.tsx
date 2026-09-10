"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteEstadoButton } from "./delete-estado-button";
import {
  updateEstado,
  type EstadoActionState,
} from "./actions";

const INITIAL: EstadoActionState = { error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Guardando…" : "Guardar"}
    </Button>
  );
}

export function EditEstadoRow({
  estado,
  slug,
}: {
  estado: {
    id: string;
    evento_id: string | null;
    nombre: string;
    color: string | null;
    orden: number;
    es_estado_final: boolean;
  };
  slug: string;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateEstado.bind(null, estado.id, slug);
  const [state, formAction] = useActionState(action, INITIAL);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={formAction} className="flex flex-wrap items-end gap-4">
          <div className="min-w-56 flex-1">
            <label htmlFor={`estado-${estado.id}`} className="text-xs text-muted-foreground">
              Nombre
            </label>
            <Input
              id={`estado-${estado.id}`}
              name="nombre"
              defaultValue={estado.nombre}
              required
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor={`color-${estado.id}`} className="text-xs text-muted-foreground">
              Color
            </label>
            <Input
              id={`color-${estado.id}`}
              name="color"
              type="color"
              defaultValue={estado.color ?? "#94a3b8"}
              className="mt-1 w-16 p-1"
            />
          </div>
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="es_estado_final"
              defaultChecked={estado.es_estado_final}
              className="size-4"
            />
            Estado final
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <SaveButton />
          </div>
          {state.error ? (
            <p className="w-full text-sm text-destructive">{state.error}</p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span
        className="size-4 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: estado.color ?? "#e5e5e5" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{estado.nombre}</p>
        <p className="text-xs text-muted-foreground">
          Orden {estado.orden}
          {estado.es_estado_final ? " · Estado final" : ""}
          {estado.evento_id ? "" : " · Global"}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
        Editar
      </Button>
      <DeleteEstadoButton id={estado.id} slug={slug} nombre={estado.nombre} />
    </li>
  );
}
