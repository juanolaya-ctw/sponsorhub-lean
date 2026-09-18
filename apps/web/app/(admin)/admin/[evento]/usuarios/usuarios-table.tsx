"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleUsuarioActivo } from "./actions";
import { DeleteUsuarioButton } from "./delete-usuario-button";
import { EditUsuarioDialog } from "./edit-usuario-dialog";
import type { SponsorOption, UsuarioRow } from "./types";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayName(usuario: UsuarioRow): string {
  return usuario.nombre?.trim() || usuario.email || "Usuario";
}

function ToggleActivoButton({
  usuario,
  eventoId,
  slug,
}: {
  usuario: UsuarioRow;
  eventoId: string;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await toggleUsuarioActivo(
              usuario.id,
              eventoId,
              slug,
              !usuario.activo,
            );
            setError(result.error);
            if (!result.error) {
              router.refresh();
            }
          });
        }}
      >
        {pending
          ? "…"
          : usuario.activo
            ? "Desactivar"
            : "Activar"}
      </Button>
      {error ? <p className="max-w-56 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function UsuariosTable({
  usuarios,
  sponsors,
  eventoId,
  slug,
}: {
  usuarios: UsuarioRow[];
  sponsors: SponsorOption[];
  eventoId: string;
  slug: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Sponsor vinculado</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Última sesión</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell className="font-medium">
                {displayName(usuario)}
              </TableCell>
              <TableCell>{usuario.email ?? "—"}</TableCell>
              <TableCell>{usuario.sponsorNombre}</TableCell>
              <TableCell>{usuario.cargo ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={usuario.activo ? "secondary" : "outline"}>
                  {usuario.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(usuario.lastSignInAt)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <EditUsuarioDialog
                    usuario={usuario}
                    sponsors={sponsors}
                    eventoId={eventoId}
                    slug={slug}
                  />
                  <ToggleActivoButton
                    usuario={usuario}
                    eventoId={eventoId}
                    slug={slug}
                  />
                  <DeleteUsuarioButton
                    userId={usuario.id}
                    displayName={displayName(usuario)}
                    eventoId={eventoId}
                    slug={slug}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
