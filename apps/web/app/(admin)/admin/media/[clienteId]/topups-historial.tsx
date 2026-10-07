"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { editarTopup, eliminarTopup } from "../actions";

export type TopupRow = {
  id: string;
  cicloId: string;
  creditos: number;
  motivo: string | null;
  creadoPor: string | null;
  createdAt: string;
  periodoLabel: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    dateStyle: "medium",
  });
}

export function TopupsHistorial({
  topups,
  clienteId,
}: {
  topups: TopupRow[];
  clienteId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TopupRow | null>(null);
  const [creditos, setCreditos] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEdit(row: TopupRow) {
    setEditing(row);
    setCreditos(String(row.creditos));
    setMotivo(row.motivo ?? "");
    setError(null);
  }

  function saveEdit() {
    if (!editing) return;
    const num = parseInt(creditos, 10);
    if (!creditos || isNaN(num) || num <= 0) {
      setError("Ingresa créditos mayores a 0.");
      return;
    }
    if (!motivo.trim()) {
      setError("El motivo es requerido.");
      return;
    }
    startTransition(async () => {
      const result = await editarTopup(
        editing.id,
        num,
        motivo.trim(),
        clienteId,
      );
      if (result.error) setError(result.error);
      else {
        setEditing(null);
        router.refresh();
      }
    });
  }

  if (topups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Aún no hay top-ups registrados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Por</TableHead>
              <TableHead className="w-24 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topups.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-sm">
                  {formatDate(row.createdAt)}
                </TableCell>
                <TableCell className="capitalize text-sm">
                  {row.periodoLabel}
                </TableCell>
                <TableCell className="font-medium">+{row.creditos}</TableCell>
                <TableCell className="max-w-xs text-sm">
                  {row.motivo ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.creadoPor ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(row)}
                      aria-label="Editar top-up"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          aria-label="Eliminar top-up"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar top-up</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se restarán {row.creditos} créditos del ciclo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            disabled={pending}
                            onClick={(event) => {
                              event.preventDefault();
                              startTransition(async () => {
                                const result = await eliminarTopup(
                                  row.id,
                                  clienteId,
                                );
                                if (result.error) setError(result.error);
                                else router.refresh();
                              });
                            }}
                          >
                            {pending ? "Eliminando…" : "Eliminar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar top-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="edit-topup-cr">Créditos</Label>
              <Input
                id="edit-topup-cr"
                type="number"
                min={1}
                value={creditos}
                onChange={(e) => setCreditos(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-topup-motivo">Motivo</Label>
              <Input
                id="edit-topup-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={saveEdit}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
