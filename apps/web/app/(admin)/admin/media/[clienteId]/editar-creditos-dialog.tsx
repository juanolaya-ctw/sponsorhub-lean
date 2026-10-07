"use client";

import { useState, useTransition, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { actualizarCreditosCiclo } from "../actions";

export function EditarCreditosDialog({
  billingCycleId,
  creditosActuales,
  clienteId,
}: {
  billingCycleId: string;
  creditosActuales: number;
  clienteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creditos, setCreditos] = useState(String(creditosActuales));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setCreditos(String(creditosActuales));
        setError(null);
      }
    },
    [creditosActuales],
  );

  function handleSubmit() {
    const num = parseInt(creditos, 10);
    if (!creditos || isNaN(num) || num <= 0) {
      setError("Ingresa un monto de créditos mayor a 0.");
      return;
    }
    startTransition(async () => {
      const result = await actualizarCreditosCiclo(
        billingCycleId,
        num,
        clienteId,
      );
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar créditos del ciclo</DialogTitle>
          <DialogDescription>
            Ajusta el monto del deal (ej. One Time 2000 / 2500 / 3000) sin
            cambiar el plan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="creditos-asignados">Créditos asignados</Label>
            <Input
              id="creditos-asignados"
              type="number"
              min={1}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="mt-1"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
