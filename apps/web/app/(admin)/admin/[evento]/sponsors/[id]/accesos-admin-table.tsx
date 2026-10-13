"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteAccesoPersona, updateAccesoPersonaTipo } from "./actions";

export type AccesoPersonaAdminRow = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  documento_identidad: string | null;
  linkedin_url: string | null;
  rol_ecosistema: string | null;
  numero_celular: string | null;
  pais_residencia: string | null;
  empresa: string | null;
  industria: string | null;
  nivel_cargo: string | null;
  cargo: string | null;
  tipo: string;
};

function nombreCompleto(row: AccesoPersonaAdminRow): string {
  return [row.nombre, row.apellido].filter(Boolean).join(" ") || "—";
}

function TipoSelect({
  acceso,
  sponsorId,
  eventoSlug,
}: {
  acceso: AccesoPersonaAdminRow;
  sponsorId: string;
  eventoSlug: string;
}) {
  const initial =
    acceso.tipo === "vip" || acceso.tipo === "general" ? acceso.tipo : "general";
  const [value, setValue] = useState<"vip" | "general">(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <select
        value={value}
        disabled={pending}
        aria-label={`Tipo de acceso de ${nombreCompleto(acceso)}`}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm capitalize disabled:opacity-60"
        onChange={(event) => {
          const next = event.target.value as "vip" | "general";
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateAccesoPersonaTipo(
              acceso.id,
              sponsorId,
              eventoSlug,
              next,
            );
            if (result.error) {
              setValue(previous);
              setError(result.error);
            }
          });
        }}
      >
        <option value="general">General</option>
        <option value="vip">VIP</option>
      </select>
      {error ? (
        <p className="mt-1 max-w-40 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function DeleteButton({
  acceso,
  sponsorId,
  eventoSlug,
}: {
  acceso: AccesoPersonaAdminRow;
  sponsorId: string;
  eventoSlug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `¿Eliminar a ${nombreCompleto(acceso)} de los accesos?`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            const result = await deleteAccesoPersona(
              acceso.id,
              sponsorId,
              eventoSlug,
            );
            setError(result.error);
          });
        }}
      >
        {pending ? "…" : "Eliminar"}
      </Button>
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

export function AccesosAdminTable({
  accesos,
  sponsorId,
  eventoSlug,
}: {
  accesos: AccesoPersonaAdminRow[];
  sponsorId: string;
  eventoSlug: string;
}) {
  if (accesos.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <p className="font-medium">Este sponsor aún no ha registrado personas</p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Nombre completo</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>LinkedIn</TableHead>
            <TableHead>Rol ecosistema</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>País</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Industria</TableHead>
            <TableHead>Nivel de cargo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accesos.map((persona) => (
            <TableRow key={persona.id}>
              <TableCell>
                <TipoSelect
                  acceso={persona}
                  sponsorId={sponsorId}
                  eventoSlug={eventoSlug}
                />
              </TableCell>
              <TableCell className="font-medium">
                {nombreCompleto(persona)}
              </TableCell>
              <TableCell>{persona.documento_identidad ?? "—"}</TableCell>
              <TableCell>{persona.email ?? "—"}</TableCell>
              <TableCell>
                {persona.linkedin_url ? (
                  <a
                    href={persona.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary hover:underline"
                  >
                    Ver perfil
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{persona.rol_ecosistema ?? "—"}</TableCell>
              <TableCell>{persona.numero_celular ?? "—"}</TableCell>
              <TableCell>{persona.pais_residencia ?? "—"}</TableCell>
              <TableCell>{persona.empresa ?? "—"}</TableCell>
              <TableCell>{persona.industria ?? "—"}</TableCell>
              <TableCell>
                {persona.nivel_cargo ?? persona.cargo ?? "—"}
              </TableCell>
              <TableCell>
                <DeleteButton
                  acceso={persona}
                  sponsorId={sponsorId}
                  eventoSlug={eventoSlug}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
