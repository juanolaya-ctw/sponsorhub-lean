"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { crearPlan, actualizarPlan, togglePlan } from "../actions";
import type { MediaPlan } from "./page";

function PlanForm({
  initial,
  onSuccess,
}: {
  initial?: MediaPlan;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [creditos, setCreditos] = useState(String(initial?.creditosMensuales ?? ""));
  const [precio, setPrecio] = useState(String(initial?.precioUsd ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const creditosNum = parseInt(creditos, 10);
    const precioNum = parseFloat(precio);
    if (!nombre.trim()) { setError("El nombre es requerido."); return; }
    if (isNaN(creditosNum) || creditosNum <= 0) { setError("Los créditos deben ser > 0."); return; }
    if (isNaN(precioNum) || precioNum < 0) { setError("El precio debe ser ≥ 0."); return; }
    startTransition(async () => {
      const result = initial
        ? await actualizarPlan(initial.id, nombre.trim(), creditosNum, precioNum)
        : await crearPlan(nombre.trim(), creditosNum, precioNum);
      if (result.error) { setError(result.error); } else { onSuccess(); }
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <Label htmlFor="plan-nombre">Nombre</Label>
        <Input id="plan-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="plan-creditos">Créditos / mes</Label>
        <Input id="plan-creditos" type="number" min={1} value={creditos} onChange={(e) => setCreditos(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="plan-precio">Precio USD</Label>
        <Input id="plan-precio" type="number" min={0} step={0.01} value={precio} onChange={(e) => setPrecio(e.target.value)} className="mt-1" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" disabled={pending} onClick={handleSubmit}>
          {pending ? "Guardando…" : initial ? "Actualizar" : "Crear plan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function PlanesTable({ planes }: { planes: MediaPlan[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [editingPlan, setEditingPlan] = useState<MediaPlan | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCreateSuccess = useCallback(() => { setCreateOpen(false); router.refresh(); }, [router]);
  const handleEditSuccess = useCallback(() => { setEditingPlan(null); router.refresh(); }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(next) => { setCreateOpen(next); if (next) setCreateKey((k) => k + 1); }}
        >
          <DialogTrigger asChild>
            <Button type="button">+ Nuevo plan</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nuevo plan</DialogTitle></DialogHeader>
            <PlanForm key={createKey} onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {planes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Sin planes configurados</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Créditos / mes</TableHead>
                <TableHead>Precio USD</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.nombre}</TableCell>
                  <TableCell>{plan.creditosMensuales.toLocaleString("en-US")}</TableCell>
                  <TableCell>
                    ${plan.precioUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.activo ? "secondary" : "outline"}>
                      {plan.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlan(plan)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={plan.activo ? "destructive" : "outline"}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await togglePlan(plan.id, !plan.activo);
                            router.refresh();
                          });
                        }}
                      >
                        {plan.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editingPlan} onOpenChange={(next) => { if (!next) setEditingPlan(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar plan</DialogTitle></DialogHeader>
          {editingPlan ? <PlanForm initial={editingPlan} onSuccess={handleEditSuccess} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
