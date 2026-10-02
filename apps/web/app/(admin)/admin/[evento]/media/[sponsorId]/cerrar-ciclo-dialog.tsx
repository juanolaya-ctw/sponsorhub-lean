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
import { cerrarCiclo } from "../actions";

type Plan = { id: string; nombre: string; creditosMensuales: number };

export function CerrarCicloDialog({
  billingCycleId,
  currentPlanId,
  planes,
  disponibles,
  slug,
  sponsorId,
}: {
  billingCycleId: string;
  currentPlanId: string;
  planes: Plan[];
  disponibles: number;
  slug: string;
  sponsorId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentPlanId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPlan = planes.find((p) => p.id === planId) ?? null;
  const rolloverEstimado = selectedPlan
    ? Math.min(Math.max(disponibles, 0), selectedPlan.creditosMensuales)
    : 0;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setPlanId(currentPlanId);
        setError(null);
      }
    },
    [currentPlanId],
  );

  function handleSubmit() {
    if (!planId) {
      setError("Selecciona un plan para el siguiente ciclo.");
      return;
    }
    startTransition(async () => {
      const result = await cerrarCiclo(
        billingCycleId,
        planId,
        slug,
        sponsorId,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Cerrar ciclo →
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar ciclo y abrir siguiente</DialogTitle>
          <DialogDescription>
            Se calculará el rollover y se creará el ciclo del mes siguiente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p>
              Créditos disponibles actuales:{" "}
              <strong>{Math.max(disponibles, 0)}</strong>
            </p>
            <p className="mt-1">
              Rollover estimado al siguiente ciclo:{" "}
              <strong>{rolloverEstimado}</strong>
              <span className="text-muted-foreground">
                {" "}
                (máx. 1 mes del nuevo plan)
              </span>
            </p>
          </div>
          <div>
            <Label>Plan para el siguiente ciclo</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.creditosMensuales.toLocaleString()} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Cerrando…" : "Confirmar y cerrar ciclo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
