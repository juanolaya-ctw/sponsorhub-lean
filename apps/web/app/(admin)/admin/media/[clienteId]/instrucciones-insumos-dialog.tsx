"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { actualizarInstruccionesInsumos } from "../actions";
import {
  InstruccionesInsumosFields,
  type InstruccionesInsumosValue,
} from "./instrucciones-insumos-fields";

export function InstruccionesInsumosDialog({
  assetId,
  assetNombre,
  clienteId,
  initial,
  definidas,
}: {
  assetId: string;
  assetNombre: string;
  clienteId: string;
  initial: InstruccionesInsumosValue;
  definidas: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setValue(initial);
        setError(null);
      }
    },
    [initial],
  );

  function handleSubmit() {
    startTransition(async () => {
      const result = await actualizarInstruccionesInsumos(assetId, clienteId, {
        instrucciones: value.instrucciones,
        formato: value.formato,
        fechaLimite: value.fechaLimite,
      });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={definidas ? "ghost" : "outline"}>
          {definidas ? "Insumos" : "+ Insumos"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Insumos: {assetNombre}</DialogTitle>
          <DialogDescription>
            Indica al cliente qué archivos necesitas para esta pieza.
          </DialogDescription>
        </DialogHeader>
        <InstruccionesInsumosFields
          value={value}
          onChange={setValue}
          idPrefix={`insumos-${assetId}`}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
