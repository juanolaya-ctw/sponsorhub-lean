"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activarMediaCliente } from "../actions";

type Plan = { id: string; nombre: string; creditosMensuales: number };

export function ActivarCicloDialog({
  clienteId,
  planes,
}: {
  clienteId: string;
  planes: Plan[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState("");
  const [creditos, setCreditos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedPlan = planes.find((p) => p.id === planId) ?? null;

  useEffect(() => {
    if (selectedPlan) {
      setCreditos(String(selectedPlan.creditosMensuales));
    }
  }, [selectedPlan]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setPlanId("");
      setCreditos("");
      setError(null);
    }
  }, []);

  function handleSubmit() {
    if (!planId) {
      setError("Selecciona un plan.");
      return;
    }
    const num = parseInt(creditos, 10);
    if (!creditos || isNaN(num) || num <= 0) {
      setError("Ingresa un monto de créditos mayor a 0.");
      return;
    }
    startTransition(async () => {
      const result = await activarMediaCliente(clienteId, planId, num);
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
        <Button type="button">+ Activar Media</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activar Media</DialogTitle>
          <DialogDescription>
            Crea el primer ciclo. Puedes ajustar los créditos del deal.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — base {p.creditosMensuales.toLocaleString()} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="activar-creditos">Créditos del deal</Label>
            <Input
              id="activar-creditos"
              type="number"
              min={1}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="mt-1"
              disabled={!planId}
              placeholder="Ej. 2000, 2500, 3000"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Por defecto usa la base del plan; ajústalo según el deal.
            </p>
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
            {pending ? "Activando…" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
