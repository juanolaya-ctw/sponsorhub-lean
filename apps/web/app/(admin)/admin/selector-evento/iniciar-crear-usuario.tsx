"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildCrearUsuarioEventoHref,
  type SponsorConEvento,
} from "@/lib/admin/create-usuario-guards"

export function IniciarCrearUsuarioPanel({
  sponsors,
}: {
  sponsors: SponsorConEvento[]
}) {
  const router = useRouter()
  const [sponsorId, setSponsorId] = useState("")

  const selected = useMemo(
    () => sponsors.find((s) => s.id === sponsorId) ?? null,
    [sponsors, sponsorId],
  )

  const handleContinue = () => {
    if (!selected) return
    router.push(buildCrearUsuarioEventoHref(selected))
  }

  if (sponsors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay sponsors para iniciar la creación. Entra a un evento o sincroniza
        sponsors primero.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="panel-sponsor">Sponsor</Label>
        <Select
          value={sponsorId}
          onValueChange={(value) => setSponsorId(value ?? "")}
        >
          <SelectTrigger id="panel-sponsor" className="mt-1 w-full">
            <SelectValue placeholder="Seleccionar sponsor" />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((sponsor) => (
              <SelectItem key={sponsor.id} value={sponsor.id}>
                {sponsor.nombre} · {sponsor.eventoNombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Evento: {selected.eventoNombre} ({selected.eventoSlug})
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Se abrirá la vista de usuarios del evento del sponsor. Misma
            autorización y formulario por evento.
          </p>
        )}
      </div>
      <Button
        type="button"
        disabled={!selected}
        onClick={handleContinue}
        aria-label="Continuar a crear usuario en el evento del sponsor"
      >
        Continuar
      </Button>
    </div>
  )
}
