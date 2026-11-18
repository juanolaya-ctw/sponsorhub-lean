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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cerrarCicloCliente } from "../actions"
import { isCierreMensualCompatible } from "@/lib/media/acuerdo"

type Plan = {
  id: string
  nombre: string
  creditosMensuales: number
  tarifaCreditoUsd: number | null
}

export function CerrarCicloDialog({
  billingCycleId,
  currentPlanId,
  planes,
  disponibles,
  clienteId,
  fechaInicio,
  fechaFin,
}: {
  billingCycleId: string
  currentPlanId: string
  planes: Plan[]
  disponibles: number
  clienteId: string
  fechaInicio: string | null
  fechaFin: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState(currentPlanId)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const cierreCompatible = isCierreMensualCompatible({ fechaInicio, fechaFin })
  const selectedPlan = planes.find((p) => p.id === planId) ?? null
  const rolloverEstimado = selectedPlan
    ? Math.min(Math.max(disponibles, 0), selectedPlan.creditosMensuales)
    : 0

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next) {
        setPlanId(currentPlanId)
        setError(null)
      }
    },
    [currentPlanId],
  )

  const handleSubmit = () => {
    if (!cierreCompatible) {
      setError(
        "Este acuerdo usa un período libre. El cierre mensual automático no aplica.",
      )
      return
    }
    if (!planId) {
      setError("Selecciona un plan para el siguiente ciclo.")
      return
    }
    startTransition(async () => {
      const result = await cerrarCicloCliente(
        billingCycleId,
        planId,
        clienteId,
      )
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (!cierreCompatible) {
    return (
      <div className="max-w-xs text-right text-xs text-muted-foreground">
        Período libre: el cierre mensual automático no aplica. No se inventa el
        siguiente período ni el destino del saldo.
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Cerrar ciclo →
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar ciclo y abrir siguiente</DialogTitle>
          <DialogDescription>
            Se calculará el rollover y se creará el ciclo del mes siguiente. El
            nuevo ciclo no hereda monto ni fechas de contrato inventados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p>
              Créditos disponibles: <strong>{Math.max(disponibles, 0)}</strong>
            </p>
            <p className="mt-1">
              Rollover estimado: <strong>{rolloverEstimado}</strong>
              <span className="text-muted-foreground">
                {" "}
                (máx. 1 mes del nuevo plan)
              </span>
            </p>
          </div>
          <div>
            <Label>Plan para el siguiente ciclo</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.creditosMensuales.toLocaleString()} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {pending ? "Cerrando…" : "Confirmar y cerrar ciclo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
