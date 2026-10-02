"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCatalogAsset,
  updateCatalogAsset,
  toggleCatalogAsset,
} from "../actions";
import type { CatalogAsset } from "./page";

function AssetForm({
  initial,
  slug,
  onSuccess,
}: {
  initial?: CatalogAsset;
  slug: string;
  onSuccess: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [costo, setCosto] = useState(String(initial?.costoCreditos ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    const costoNum = parseInt(costo, 10);
    if (!nombre.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    if (!costo || isNaN(costoNum) || costoNum <= 0) {
      setError("El costo debe ser un número positivo.");
      return;
    }
    startTransition(async () => {
      const result = initial
        ? await updateCatalogAsset(
            initial.id,
            nombre.trim(),
            descripcion.trim() || null,
            costoNum,
            slug,
          )
        : await createCatalogAsset(
            nombre.trim(),
            descripcion.trim() || null,
            costoNum,
            slug,
          );

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div>
        <Label htmlFor="asset-nombre">Nombre</Label>
        <Input
          id="asset-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="asset-descripcion">Descripción</Label>
        <Textarea
          id="asset-descripcion"
          value={descripcion ?? ""}
          onChange={(e) => setDescripcion(e.target.value)}
          className="mt-1"
          rows={2}
        />
      </div>
      <div>
        <Label htmlFor="asset-costo">Costo (créditos)</Label>
        <Input
          id="asset-costo"
          type="number"
          min={1}
          value={costo}
          onChange={(e) => setCosto(e.target.value)}
          className="mt-1"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" disabled={pending} onClick={handleSubmit}>
          {pending ? "Guardando…" : initial ? "Actualizar" : "Crear asset"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function CreateAssetDialog({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">+ Nuevo asset</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo asset</DialogTitle>
        </DialogHeader>
        <AssetForm key={key} slug={slug} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({ asset, slug }: { asset: CatalogAsset; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar asset</DialogTitle>
        </DialogHeader>
        <AssetForm key={key} initial={asset} slug={slug} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}

function ToggleAssetButton({
  asset,
  slug,
}: {
  asset: CatalogAsset;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (asset.activo) {
    return (
      <div className="flex flex-col items-end gap-1">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="sm" variant="destructive">
              Desactivar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desactivar asset</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Desactivar &quot;{asset.nombre}&quot;? Ya no aparecerá en el
                selector de activación de assets, pero los existentes no se
                verán afectados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await toggleCatalogAsset(
                      asset.id,
                      false,
                      slug,
                    );
                    setError(result.error);
                    if (!result.error) router.refresh();
                  });
                }}
              >
                {pending ? "Desactivando…" : "Desactivar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {error ? (
          <p className="max-w-72 text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleCatalogAsset(asset.id, true, slug);
          if (result.error) setError(result.error);
          else router.refresh();
        });
      }}
    >
      {pending ? "Activando…" : "Activar"}
    </Button>
  );
}

export function CatalogoTable({
  assets,
  slug,
}: {
  assets: CatalogAsset[];
  slug: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateAssetDialog slug={slug} />
      </div>
      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">El catálogo está vacío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el primer asset con el botón &quot;+ Nuevo asset&quot;.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Costo (cr.)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.descripcion ?? "—"}
                  </TableCell>
                  <TableCell>{asset.costoCreditos}</TableCell>
                  <TableCell>
                    <Badge variant={asset.activo ? "secondary" : "outline"}>
                      {asset.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <EditAssetDialog asset={asset} slug={slug} />
                      <ToggleAssetButton asset={asset} slug={slug} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
