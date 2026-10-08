"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArticuloSponsorCard } from "@/lib/admin/articulos";
import { deleteArticulo } from "./actions";

function formatPublishedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ArticulosTabla({
  eventoSlug,
  sponsors,
  onEdit,
  onDeleted,
}: {
  eventoSlug: string;
  sponsors: ArticuloSponsorCard[];
  onEdit: (sponsorId: string) => void;
  onDeleted: (sponsorId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"published" | "all">(
    "published",
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sponsors
      .filter((s) => {
        if (!s.articulo) return false;
        if (statusFilter === "published" && s.articulo.status !== "published") {
          return false;
        }
        if (!q) return true;
        const haystack = [
          s.nombre,
          s.paquete ?? "",
          s.articulo.categoria ?? "",
          s.articulo.dato_impactante,
          s.articulo.slug ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const ta = a.articulo?.published_at
          ? new Date(a.articulo.published_at).getTime()
          : 0;
        const tb = b.articulo?.published_at
          ? new Date(b.articulo.published_at).getTime()
          : 0;
        return tb - ta;
      });
  }, [sponsors, query, statusFilter]);

  const publishedCount = sponsors.filter(
    (s) => s.articulo?.status === "published",
  ).length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sponsor, dato, categoría, slug…"
            className="sm:max-w-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "published" | "all")
            }
            className="flex h-9 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="published">Solo publicados</option>
            <option value="all">Publicados + borradores</option>
          </select>
        </div>
        <p className="text-sm text-muted-foreground">
          {publishedCount} publicado{publishedCount === 1 ? "" : "s"} ·{" "}
          {rows.length} en vista
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay artículos en esta vista</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Publica desde el grid de sponsors o cambia el filtro.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="min-w-[220px]">Dato impactante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Publicado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const art = s.articulo!;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nombre}</TableCell>
                    <TableCell>{s.paquete ?? "—"}</TableCell>
                    <TableCell>
                      {art.categoria_text ?? art.categoria ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2 max-w-md text-sm">
                        {art.dato_impactante}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          art.status === "published"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                        }
                      >
                        {art.status === "published" ? "Publicado" : "Borrador"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {art.slug ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatPublishedAt(art.published_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(s.id)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={pending && pendingId === art.id}
                            >
                              <Trash2 className="size-3.5" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Eliminar artículo
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Eliminar el artículo de {s.nombre}? Dejará de
                                aparecer en News (Lovable). Esta acción no se
                                puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={pending}
                                onClick={() => {
                                  setError(null);
                                  setPendingId(art.id);
                                  startTransition(async () => {
                                    const result = await deleteArticulo(
                                      art.id,
                                      eventoSlug,
                                    );
                                    setPendingId(null);
                                    if (!result.ok) {
                                      setError(result.error);
                                      return;
                                    }
                                    onDeleted(s.id);
                                  });
                                }}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
