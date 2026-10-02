"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateEstadoAsset } from "../actions";

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

export function EditarNotasDialog({
  assetId,
  assetNombre,
  notasCs,
  evidenciasUrl,
  slug,
  sponsorId,
  estado,
}: {
  assetId: string;
  assetNombre: string;
  notasCs: string;
  evidenciasUrl: string;
  slug: string;
  sponsorId: string;
  estado: AssetEstado;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState(notasCs);
  const [url, setUrl] = useState(evidenciasUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setNotas(notasCs);
        setUrl(evidenciasUrl);
        setError(null);
      }
    },
    [notasCs, evidenciasUrl],
  );

  function handleSubmit() {
    startTransition(async () => {
      const result = await updateEstadoAsset(
        assetId,
        estado,
        slug,
        sponsorId,
        notas || null,
        url || null,
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
        <Button type="button" size="sm" variant="ghost">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{assetNombre}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="editar-notas-cs">Notas CS</Label>
            <Textarea
              id="editar-notas-cs"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="editar-evidencias">URL de evidencias</Label>
            <Input
              id="editar-evidencias"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1"
              placeholder="https://…"
            />
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
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
