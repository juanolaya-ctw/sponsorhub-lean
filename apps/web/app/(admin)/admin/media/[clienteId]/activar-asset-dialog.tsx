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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { activarAssetCliente } from "../actions";

type CatalogItem = { id: string; nombre: string; costoCreditos: number };

export function ActivarAssetDialog({
  billingCycleId,
  catalog,
  disponibles,
  clienteId,
}: {
  billingCycleId: string;
  catalog: CatalogItem[];
  disponibles: number;
  clienteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = catalog.find((a) => a.id === assetId) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? catalog.filter((a) => a.nombre.toLowerCase().includes(q))
    : catalog;

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setAssetId("");
      setQuery("");
      setError(null);
    }
  }, []);

  function handleSubmit() {
    if (!assetId) {
      setError("Selecciona un asset.");
      return;
    }
    startTransition(async () => {
      const result = await activarAssetCliente(
        billingCycleId,
        assetId,
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
        <div className="grid gap-3">
          <div>
            <Label htmlFor="asset-search">Buscar asset</Label>
            <Input
              id="asset-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe para filtrar…"
              className="mt-1"
            />
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Sin resultados
                </p>
              ) : (
                filtered.map((a) => {
                  const insuficiente = a.costoCreditos > disponibles;
                  const active = a.id === assetId;

                  if (insuficiente) {
                    return (
                      <Tooltip key={a.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground opacity-60"
                            aria-disabled
                          >
                            <span>{a.nombre}</span>
                            <span className="shrink-0 text-xs">
                              {a.costoCreditos} cr.
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          No tienes los suficientes créditos
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAssetId(a.id)}
                      className={
                        active
                          ? "flex w-full items-center justify-between gap-2 bg-muted px-3 py-2 text-left text-sm font-medium"
                          : "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                      }
                    >
                      <span>{a.nombre}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {a.costoCreditos} cr.
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </TooltipProvider>
          {selected ? (
            <p className="text-sm text-muted-foreground">
              Costo: <strong>{selected.costoCreditos} cr.</strong> · Quedarán:{" "}
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
