"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameTier } from "./actions";

export function RenameTierButton({
  eventoId,
  eventoSlug,
  tier,
}: {
  eventoId: string;
  eventoSlug: string;
  tier: string;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(tier);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setNombre(tier);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-muted-foreground"
          aria-label={`Renombrar tier ${tier}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Renombrar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar tier</DialogTitle>
          <DialogDescription>
            El nuevo nombre se actualizará en el catálogo, en los sponsors con
            ese paquete y donde se muestre el tier.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await renameTier(
                eventoId,
                eventoSlug,
                tier,
                nombre,
              );
              if (result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tier-nombre">Nombre del tier</Label>
            <Input
              id="tier-nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !nombre.trim()}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
