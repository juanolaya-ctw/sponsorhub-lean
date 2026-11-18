"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { activarMediaCliente } from "../actions"
import { formatTarifaAcuerdo } from "@/lib/media/acuerdo"

type Plan = {
  id: string
  nombre: string
  creditosMensuales: number
  tarifaCreditoUsd: number | null
}

export function ActivarCicloDialog({
  clienteId,
  planes,
}: {
  clienteId: string
  planes: Plan[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState("")
  const [creditos, setCreditos] = useState("")
  const [monto, setMonto] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedPlan = planes.find((p) => p.id === planId) ?? null

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (next) {
      setPlanId("")
      setCreditos("")
      setMonto("")
      setFechaInicio("")
      setFechaFin("")
      setError(null)
    }
  }, [])

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId)
    // Cambiar plan no sobrescribe monto, fechas ni créditos ingresados.
  }

  const handleSubmit = () => {
    if (!planId) {
      setError("Selecciona un plan.")
      return
    }
    const creditosNum = parseInt(creditos, 10)
    const montoNum = parseFloat(monto)
    if (!creditos || isNaN(creditosNum) || creditosNum <= 0) {
      setError("Ingresa créditos totales mayores a 0.")
      return
    }
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setError("Ingresa el monto total contratado en USD.")
      return
    }
    if (!fechaInicio || !fechaFin) {
      setError("Ingresa fecha de inicio y fecha de fin.")
      return
    }

    startTransition(async () => {
      const result = await activarMediaCliente(clienteId, {
        planId,
        creditosAsignados: creditosNum,
        montoContratadoUsd: montoNum,
        fechaInicio,
        fechaFin,
      })
      if (result.error) setError(result.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">+ Activar Media</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activar Media</DialogTitle>
          <DialogDescription>
            Configura el acuerdo: plan, monto total, período de uso y créditos
            manuales. No se calculan créditos desde el monto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Plan de referencia</Label>
            <Select value={planId} onValueChange={handlePlanChange}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlan ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Tarifa de referencia:{" "}
                {formatTarifaAcuerdo(selectedPlan.tarifaCreditoUsd)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="activar-monto">Monto total contratado</Label>
              <Input
                id="activar-monto"
                type="number"
                min={0.01}
                step={0.01}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="mt-1"
                aria-label="Monto total contratado"
              />
            </div>
            <div>
              <Label htmlFor="activar-moneda">Moneda</Label>
              <Input
                id="activar-moneda"
                value="USD"
                readOnly
                className="mt-1 bg-muted"
                aria-label="Moneda del acuerdo"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="activar-inicio">Fecha de inicio</Label>
              <Input
                id="activar-inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="activar-fin">Fecha de fin</Label>
              <Input
                id="activar-fin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="activar-creditos">Créditos totales (manuales)</Label>
            <Input
              id="activar-creditos"
              type="number"
              min={1}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="mt-1"
              placeholder="Manuales; no se calculan desde el monto"
            />
          </div>
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
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Activando…" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
