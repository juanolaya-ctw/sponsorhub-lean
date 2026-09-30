"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteEntregasBulk } from "./bulk-entregables-actions";

export type EntregaEnviadaRow = {
  archivoId: string;
  sponsorId: string;
  sponsorNombre: string;
  sponsorPaquete: string | null;
};

export type EntregaBatch = {
  storagePath: string;
  tipo: string;
  nombre: string;
  isLink: boolean;
  createdAt: string;
  rows: EntregaEnviadaRow[];
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(d);
}

function BatchCard({
  batch,
  eventoSlug,
}: {
  batch: EntregaBatch;
  eventoSlug: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(archivoId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(archivoId)) next.delete(archivoId);
      else next.add(archivoId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === batch.rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(batch.rows.map((r) => r.archivoId)));
    }
  }

  function doDelete(ids: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await deleteEntregasBulk(ids, eventoSlug);
      if (result.error) { setError(result.error); return; }
      setSelected(new Set());
      router.refresh();
    });
  }

  const allIds = batch.rows.map((r) => r.archivoId);
  const selectedIds = Array.from(selected);
  const deleteTarget = selectedIds.length > 0 ? selectedIds : allIds;
  const deleteLabel =
    selectedIds.length > 0
      ? `Eliminar para ${selectedIds.length} sponsor${selectedIds.length !== 1 ? "s" : ""}`
      : `Eliminar para todos (${batch.rows.length})`;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {batch.tipo}
            </span>
            {batch.isLink ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                Link
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-medium text-sm">
            {batch.isLink ? (
              <a
                href={batch.nombre}
                target="_blank"
                rel="noreferrer"
                className="text-secondary hover:underline"
              >
                {batch.nombre}
              </a>
            ) : (
              batch.nombre
            )}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(batch.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" size="sm" disabled={pending}>
                {deleteLabel}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar entregable</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedIds.length > 0
                    ? `¿Eliminar "${batch.nombre}" para los ${selectedIds.length} sponsors seleccionados?`
                    : `¿Eliminar "${batch.nombre}" para todos los ${batch.rows.length} sponsors? Esta acción no se puede deshacer.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={pending}
                  onClick={() => doDelete(deleteTarget)}
                >
                  {pending ? "Eliminando…" : "Confirmar eliminación"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-2">
          <Checkbox
            checked={selected.size === batch.rows.length && batch.rows.length > 0}
            onCheckedChange={toggleAll}
          />
          <span className="text-xs text-muted-foreground">
            {selected.size === 0
              ? "Seleccionar sponsors para eliminar solo para ellos"
              : `${selected.size} de ${batch.rows.length} seleccionados`}
          </span>
        </div>
        {batch.rows.map((row) => (
          <label
            key={row.archivoId}
            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
          >
            <Checkbox
              checked={selected.has(row.archivoId)}
              onCheckedChange={() => toggle(row.archivoId)}
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{row.sponsorNombre}</span>
              {row.sponsorPaquete ? (
                <span className="ml-2 text-xs text-muted-foreground">{row.sponsorPaquete}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      {error ? (
        <p className="border-t border-border px-4 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </article>
  );
}

export function EntregablesEnviados({
  batches,
  eventoSlug,
}: {
  batches: EntregaBatch[];
  eventoSlug: string;
}) {
  if (batches.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <p className="font-medium">Aún no se han enviado entregables</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {batches.map((batch) => (
        <BatchCard key={batch.storagePath + batch.createdAt} batch={batch} eventoSlug={eventoSlug} />
      ))}
    </div>
  );
}
