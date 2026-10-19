"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AccesoPersonaAdminRow } from "./accesos-admin-table"
import { deleteAccesoPersona } from "./actions"

export type StandCupoAdmin = {
  compromisoId: string
  nombre: string
  cupo: number | null
}

function nombreCompleto(row: AccesoPersonaAdminRow): string {
  return [row.nombre, row.apellido].filter(Boolean).join(" ") || "—"
}

export function PersonalStandAdmin({
  stands,
  personas,
  sponsorId,
  eventoSlug,
}: {
  stands: StandCupoAdmin[]
  personas: AccesoPersonaAdminRow[]
  sponsorId: string
  eventoSlug: string
}) {
  if (stands.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Este sponsor no tiene beneficios de stand.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-6">
      {stands.map((stand) => {
        const delStand = personas.filter(
          (p) =>
            p.tipo === "arl_montaje" &&
            (p.compromiso_id === stand.compromisoId ||
              (!p.compromiso_id && stands.length === 1)),
        )
        const cupoLabel =
          stand.cupo != null
            ? `${delStand.length} / ${stand.cupo}`
            : `${delStand.length}`

        return (
          <div
            key={stand.compromisoId}
            className="overflow-hidden rounded-xl border border-border bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <p className="font-medium">{stand.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  Operadores inscritos: {cupoLabel}
                </p>
              </div>
            </div>

            {delStand.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aún no hay personal inscrito para este stand.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Celular</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delStand.map((persona) => (
                      <StandPersonaRow
                        key={persona.id}
                        persona={persona}
                        sponsorId={sponsorId}
                        eventoSlug={eventoSlug}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StandPersonaRow({
  persona,
  sponsorId,
  eventoSlug,
}: {
  persona: AccesoPersonaAdminRow
  sponsorId: string
  eventoSlug: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <TableRow>
      <TableCell className="font-medium">{nombreCompleto(persona)}</TableCell>
      <TableCell>{persona.documento_identidad ?? "—"}</TableCell>
      <TableCell>{persona.email ?? "—"}</TableCell>
      <TableCell>{persona.numero_celular ?? "—"}</TableCell>
      <TableCell>{persona.empresa ?? "—"}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                `¿Eliminar a ${nombreCompleto(persona)} del personal de stand?`,
              )
            ) {
              return
            }
            startTransition(async () => {
              await deleteAccesoPersona(persona.id, sponsorId, eventoSlug)
            })
          }}
        >
          {pending ? "…" : "Eliminar"}
        </Button>
      </TableCell>
    </TableRow>
  )
}
