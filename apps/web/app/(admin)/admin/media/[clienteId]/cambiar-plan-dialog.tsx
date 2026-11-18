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
import { actualizarAcuerdoCiclo } from "../actions"
import { formatTarifaAcuerdo } from "@/lib/media/acuerdo"

type Plan = {
  id: string
  nombre: string
  creditosMensuales: number
  tarifaCreditoUsd: number | null
}

export function CambiarPlanDialog({
  billingCycleId,
  currentPlanId,
  currentCreditos,
  currentMontoUsd,
  currentFechaInicio,
  currentFechaFin,
  planes,
  clienteId,
}: {
  billingCycleId: string
  currentPlanId: string
  currentCreditos: number
  currentMontoUsd: number | null
  currentFechaInicio: string | null
  currentFechaFin: string | null
  planes: Plan[]
  clienteId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState(currentPlanId)
  const [creditos, setCreditos] = useState(String(currentCreditos))
  const [monto, setMonto] = useState(
    currentMontoUsd === null || currentMontoUsd === undefined
      ? ""
      : String(currentMontoUsd),
  )
  const [fechaInicio, setFechaInicio] = useState(currentFechaInicio ?? "")
  const [fechaFin, setFechaFin] = useState(currentFechaFin ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedPlan = planes.find((p) => p.id === planId) ?? null

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) {
        setPlanId(currentPlanId)
        setCreditos(String(currentCreditos))
        setMonto(
          currentMontoUsd === null || currentMontoUsd === undefined
            ? ""
            : String(currentMontoUsd),
        )
        setFechaInicio(currentFechaInicio ?? "")
        setFechaFin(currentFechaFin ?? "")
        setError(null)
      }
    },
    [
      currentPlanId,
      currentCreditos,
      currentMontoUsd,
      currentFechaInicio,
      currentFechaFin,
    ],
  )

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId)
    // Cambiar plan no sobrescribe monto, fechas ni créditos.
  }

  const handleSubmit = () => {
    if (!planId) {
      setError("Selecciona un plan.")
      return
    }
    const creditosNum = parseInt(creditos, 10)
    const montoTrim = monto.trim()
    const montoNum = montoTrim === "" ? null : parseFloat(montoTrim)
    if (!creditos || isNaN(creditosNum) || creditosNum <= 0) {
      setError("Ingresa créditos totales mayores a 0.")
      return
    }
    if (montoNum !== null && (isNaN(montoNum) || montoNum <= 0)) {
      setError("El monto total contratado debe ser mayor a 0 o quedar vacío (Sin registrar).")
      return
    }
    if ((fechaInicio && !fechaFin) || (!fechaInicio && fechaFin)) {
      setError("Completa ambas fechas o déjalas vacías (Sin registrar).")
      return
    }

    startTransition(async () => {
      const result = await actualizarAcuerdoCiclo(billingCycleId, clienteId, {
        planId,
        creditosAsignados: creditosNum,
        montoContratadoUsd: montoNum,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Configurar acuerdo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar acuerdo del ciclo</DialogTitle>
          <DialogDescription>
            Plan, monto total, período y créditos son independientes. Cambiar el
            plan solo actualiza la tarifa de referencia del acuerdo. Campos
            vacíos en históricos se conservan como Sin registrar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Plan de referencia</Label>
            <Select value={planId} onValueChange={handlePlanChange}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
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
              <Label htmlFor="acuerdo-monto">Monto total contratado</Label>
              <Input
                id="acuerdo-monto"
                type="number"
                min={0.01}
                step={0.01}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="mt-1"
                placeholder="Sin registrar"
                aria-label="Monto total contratado"
              />
            </div>
            <div>
              <Label htmlFor="acuerdo-moneda">Moneda</Label>
              <Input
                id="acuerdo-moneda"
                value="USD"
                readOnly
                className="mt-1 bg-muted"
                aria-label="Moneda del acuerdo"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="acuerdo-inicio">Fecha de inicio</Label>
              <Input
                id="acuerdo-inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="mt-1"
                aria-label="Fecha de inicio del acuerdo"
              />
              {!fechaInicio ? (
                <p className="mt-1 text-xs text-muted-foreground">Sin registrar</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="acuerdo-fin">Fecha de fin</Label>
              <Input
                id="acuerdo-fin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="mt-1"
                aria-label="Fecha de fin del acuerdo"
              />
              {!fechaFin ? (
                <p className="mt-1 text-xs text-muted-foreground">Sin registrar</p>
              ) : null}
            </div>
          </div>
          <div>
            <Label htmlFor="acuerdo-creditos">Créditos totales (manuales)</Label>
            <Input
              id="acuerdo-creditos"
              type="number"
              min={1}
              value={creditos}
              onChange={(e) => setCreditos(e.target.value)}
              className="mt-1"
              aria-label="Créditos totales manuales"
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
            {pending ? "Guardando…" : "Guardar acuerdo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
