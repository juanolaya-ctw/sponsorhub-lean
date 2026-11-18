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

export type MediaClienteOption = {
  id: string
  label: string
}

export function IniciarAccesoMediaPanel({
  clientes,
}: {
  clientes: MediaClienteOption[]
}) {
  const router = useRouter()
  const [clienteId, setClienteId] = useState("")

  const selected = useMemo(
    () => clientes.find((c) => c.id === clienteId) ?? null,
    [clientes, clienteId],
  )

  const handleContinue = () => {
    if (!selected) return
    router.push(`/admin/media/${selected.id}`)
  }

  if (clientes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay empresas Media activas. Crea o activa un cliente en CT Media
        primero.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="panel-media-cliente">Empresa Media</Label>
        <Select
          value={clienteId}
          onValueChange={(value) => setClienteId(value ?? "")}
        >
          <SelectTrigger id="panel-media-cliente" className="mt-1 w-full">
            <SelectValue placeholder="Seleccionar empresa" />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((cliente) => (
              <SelectItem key={cliente.id} value={cliente.id}>
                {cliente.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Se abre la ficha CT Media con el panel de contactos y acceso portal
          existente (crear, vincular, generar enlace).
        </p>
      </div>
      <Button
        type="button"
        disabled={!selected}
        onClick={handleContinue}
        aria-label="Continuar a contactos Media de la empresa"
      >
        Continuar
      </Button>
    </div>
  )
}
