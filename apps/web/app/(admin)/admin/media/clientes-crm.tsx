"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import { EliminarClienteButton } from "./eliminar-cliente-button";

export type ClienteRow = {
  id: string;
  nombre: string;
  empresa: string | null;
  emailContacto: string | null;
  activo: boolean;
  planNombre: string | null;
  creditosDisponibles: number | null;
  periodo: string | null;
  /** Suma de créditos asignados en todos los ciclos (proxy USD del deal). */
  inversionUsd: number;
};

function formatPeriodo(periodo: string) {
  return new Date(`${periodo}T00:00:00`).toLocaleDateString("es-CO", {
    month: "short",
    year: "numeric",
  });
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ClientesCrm({ clientes }: { clientes: ClienteRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? clientes.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.nombre.toLowerCase().includes(q) ||
          (c.empresa?.toLowerCase().includes(q) ?? false) ||
          (c.emailContacto?.toLowerCase().includes(q) ?? false)
        );
      })
    : clientes;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por nombre, empresa o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button asChild className="ml-auto">
          <Link href="/admin/media/nuevo">+ Agregar cliente</Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">
            {query
              ? "Sin resultados para esa búsqueda"
              : "Aún no hay clientes media"}
          </p>
          {!query ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Usa &quot;+ Agregar cliente&quot; para comenzar.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan activo</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Créditos disp.</TableHead>
                <TableHead>Inversión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-medium">{c.nombre}</p>
                    {c.empresa ? (
                      <p className="text-xs text-muted-foreground">
                        {c.empresa}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.emailContacto ?? "—"}
                  </TableCell>
                  <TableCell>{c.planNombre ?? "—"}</TableCell>
                  <TableCell className="capitalize text-sm">
                    {c.periodo ? formatPeriodo(c.periodo) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.creditosDisponibles !== null ? (
                      <Badge
                        variant={
                          c.creditosDisponibles <= 0
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {c.creditosDisponibles} cr.
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {c.inversionUsd > 0 ? formatUsd(c.inversionUsd) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.activo ? "default" : "outline"}>
                      {c.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/media/${c.id}`}>Ver perfil</Link>
                      </Button>
                      <EliminarClienteButton
                        clienteId={c.id}
                        nombre={c.nombre}
                      />
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
