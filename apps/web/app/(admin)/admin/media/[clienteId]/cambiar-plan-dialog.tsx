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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cambiarPlanCiclo } from "../actions";

type Plan = { id: string; nombre: string; creditosMensuales: number };

export function CambiarPlanDialog({
  billingCycleId,
  currentPlanId,
  planes,
  clienteId,
}: {
  billingCycleId: string;
  currentPlanId: string;
  planes: Plan[];
  clienteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentPlanId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) { setPlanId(currentPlanId); setError(null); }
    },
    [currentPlanId],
  );

  function handleSubmit() {
    if (!planId) { setError("Selecciona un plan."); return; }
    if (planId === currentPlanId) { setOpen(false); return; }
    startTransition(async () => {
      const result = await cambiarPlanCiclo(billingCycleId, planId, clienteId);
      if (result.error) { setError(result.error); }
      else { setOpen(false); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-auto p-0 text-sm text-muted-foreground underline-offset-2 hover:underline">
          Cambiar plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar plan del ciclo activo</DialogTitle>
          <DialogDescription>
            Actualiza el plan y los créditos asignados para el ciclo en curso.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Nuevo plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.creditosMensuales.toLocaleString("en-US")} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Guardando…" : "Confirmar cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
