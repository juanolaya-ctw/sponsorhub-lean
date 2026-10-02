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
import { agregarTopup } from "../actions";

export function TopupDialog({
  cicloId,
  clienteId,
}: {
  cicloId: string;
  clienteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creditos, setCreditos] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) { setCreditos(""); setMotivo(""); setError(null); }
  }, []);

  function handleSubmit() {
    const num = parseInt(creditos, 10);
    if (!creditos || isNaN(num) || num <= 0) {
      setError("Ingresa un número de créditos positivo.");
      return;
    }
    if (!motivo.trim()) {
      setError("El motivo es requerido.");
      return;
    }
    startTransition(async () => {
      const result = await agregarTopup(cicloId, num, motivo.trim(), clienteId);
      if (result.error) { setError(result.error); } else { setOpen(false); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">+ Top-up</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar top-up de créditos</DialogTitle>
          <DialogDescription>
            Los créditos extra se suman inmediatamente al ciclo actual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="topup-creditos">Créditos a agregar</Label>
            <Input
              id="topup-creditos"
              type="number"
              min={1}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="topup-motivo">Motivo</Label>
            <Input
              id="topup-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1"
              placeholder="Ej: ajuste comercial, compensación…"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Guardando…" : "Agregar créditos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
