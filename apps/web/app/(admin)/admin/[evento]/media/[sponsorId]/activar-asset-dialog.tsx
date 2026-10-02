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
import { activarAsset } from "../actions";

type CatalogItem = { id: string; nombre: string; costoCreditos: number };

export function ActivarAssetDialog({
  billingCycleId,
  catalog,
  disponibles,
  slug,
  sponsorId,
}: {
  billingCycleId: string;
  catalog: CatalogItem[];
  disponibles: number;
  slug: string;
  sponsorId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = catalog.find((a) => a.id === assetId) ?? null;

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setAssetId("");
      setError(null);
    }
  }, []);

  function handleSubmit() {
    if (!assetId) {
      setError("Selecciona un asset.");
      return;
    }
    startTransition(async () => {
      const result = await activarAsset(
        billingCycleId,
        assetId,
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
        <Button type="button" size="sm">
          + Activar asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activar asset</DialogTitle>
          <DialogDescription>
            Disponibles: <strong>{disponibles} créditos</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Asset del catálogo</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Seleccionar asset" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={a.id}
                    disabled={a.costoCreditos > disponibles}
                  >
                    {a.nombre} — {a.costoCreditos} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected ? (
            <p className="text-sm text-muted-foreground">
              Costo: <strong>{selected.costoCreditos} créditos</strong> ·
              Quedarán:{" "}
              <strong>{disponibles - selected.costoCreditos}</strong>
            </p>
          ) : null}
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
          <Button
            type="button"
            disabled={pending || !assetId}
            onClick={handleSubmit}
          >
            {pending ? "Activando…" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
