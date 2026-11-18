"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  estadoCliente,
  formatFechaCorta,
  formatUsdTarifa,
  piezaEjecutada,
  type AssetEstadoCliente,
  type ResumenSaldo,
} from "@/lib/media/portal-cliente"
import {
  firmarDescargaInsumoMediaContacto,
  subirInsumoMediaContacto,
} from "./contacto-insumos-actions"

const MAX_MB = 15

export type ContactoMediaAsset = {
  id: string
  /** #n estable dentro del ciclo (orden de creación). */
  numero: number
  nombre: string
  estado: AssetEstadoCliente
  costoCreditos: number
  clienteId: string
  creadaEl: string | null
  entregadaEl: string | null
  instrucciones: string | null
  formato: string | null
  fechaLimite: string | null
  insumos: {
    id: string
    nombreArchivo: string
    createdAt: string
  }[]
}

export type ContactoMediaCycle = {
  id: string
  esActual: boolean
  periodoLabel: string
  periodoEsRango: boolean
  saldo: ResumenSaldo
  plan: {
    nombre: string | null
    tarifaCreditoUsd: number | null
    montoContratadoUsd: number | null
  }
  assets: ContactoMediaAsset[]
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  })
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

const n = (v: number) => v.toLocaleString("es-CO")

export function ContactoMediaView({
  ready,
  empresas,
  cycles,
}: {
  ready: boolean
  empresas: { id: string; nombre: string }[]
  cycles: ContactoMediaCycle[]
}) {
  if (!ready) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <h1 className="text-2xl font-semibold">Media</h1>
        <p className="text-sm text-muted-foreground">
          Tu acceso a Media todavía no está activo. Escríbele a tu contacto en
          Colombia Tech si lo necesitas.
        </p>
      </main>
    )
  }

  const empresaLabel = empresas.map((e) => e.nombre).join(" · ")

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Media</h1>
        {empresaLabel ? (
          <p className="mt-1 text-sm font-medium text-foreground">
            {empresaLabel}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí ves los créditos de tu plan, las piezas que Colombia Tech está
          preparando para ti y los archivos que necesitamos para producirlas.
        </p>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Todavía no tienes un plan activo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando Colombia Tech active tu plan, aquí verás tus créditos y tus
            piezas.
          </p>
        </div>
      ) : (
        cycles.map((cycle) => <CycleSection key={cycle.id} cycle={cycle} />)
      )}
    </main>
  )
}

function CycleSection({ cycle }: { cycle: ContactoMediaCycle }) {
  const { saldo } = cycle
  const pendientesTuyas = cycle.assets.filter(
    (a) => estadoCliente(a.estado).esTurnoCliente,
  ).length

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {cycle.periodoEsRango ? "Vigencia del plan" : "Periodo"}
            </p>
            <p className="font-medium capitalize">{cycle.periodoLabel}</p>
          </div>
          <Badge variant={cycle.esActual ? "secondary" : "outline"}>
            {cycle.esActual ? "Plan actual" : "Periodo anterior"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Créditos del plan</p>
            <p className="text-2xl font-bold">{n(saldo.pool)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Asignados a piezas
            </p>
            <p className="text-2xl font-bold">{n(saldo.asignadosPiezas)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Usados (piezas ejecutadas)
            </p>
            <p className="text-2xl font-bold">{n(saldo.usados)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Disponibles para nuevas piezas
            </p>
            <p className="text-2xl font-bold">{n(saldo.disponibles)}</p>
          </div>
        </div>
        <div
          className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${saldo.porcentajeAsignado}% de los créditos asignados a piezas, ${saldo.porcentajeUsado}% usados`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-secondary/40"
            style={{ width: `${saldo.porcentajeAsignado}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-secondary"
            style={{ width: `${saldo.porcentajeUsado}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {saldo.pool > 0 && saldo.disponibles === 0
            ? "Todos tus créditos ya están asignados a las piezas de abajo. "
            : "Cada pieza planeada tiene créditos asignados. "}
          Los créditos solo se cuentan como usados cuando Colombia Tech ejecuta
          la pieza.
        </p>

        <details className="mt-4 rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            Ver plan
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">
                {cycle.plan.nombre ?? "Colombia Tech te confirmará el nombre del plan"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {cycle.periodoEsRango ? "Vigencia" : "Periodo"}
              </dt>
              <dd className="font-medium capitalize">{cycle.periodoLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Créditos incluidos</dt>
              <dd className="font-medium">{n(saldo.pool)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Valor por crédito</dt>
              <dd className="font-medium">
                {formatUsdTarifa(cycle.plan.tarifaCreditoUsd) ??
                  "Colombia Tech te lo confirmará"}
              </dd>
            </div>
            {cycle.plan.montoContratadoUsd !== null ? (
              <div>
                <dt className="text-muted-foreground">Valor contratado</dt>
                <dd className="font-medium">
                  {formatUsd(cycle.plan.montoContratadoUsd)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Piezas planeadas</dt>
              <dd className="font-medium">{cycle.assets.length}</dd>
            </div>
          </dl>
        </details>
      </div>

      {cycle.assets.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">
            {pendientesTuyas > 0
              ? `Tienes ${pendientesTuyas} ${pendientesTuyas === 1 ? "pieza" : "piezas"} esperando tus archivos.`
              : "No tienes archivos pendientes por ahora."}
          </p>
          <p className="mt-1 text-muted-foreground">
            Sube en cada pieza los archivos que te pedimos (máx. {MAX_MB} MB por
            archivo). Subir un archivo no aprueba la pieza: el equipo de
            Colombia Tech lo revisa y actualiza el estado.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aún no hay piezas planeadas en este periodo.
        </p>
      )}

      <div className="space-y-3">
        {cycle.assets.map((asset) => (
          <AssetInsumosCard key={asset.id} asset={asset} />
        ))}
      </div>
    </section>
  )
}

function AssetInsumosCard({ asset }: { asset: ContactoMediaAsset }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const estado = estadoCliente(asset.estado)
  const titulo = `#${asset.numero} · ${asset.nombre}`
  const fechaLimite = formatFechaCorta(asset.fechaLimite)
  const creada = formatDateTime(asset.creadaEl)
  const entregada = formatDateTime(asset.entregadaEl)
  const hayInstrucciones = Boolean(
    asset.instrucciones || asset.formato || fechaLimite,
  )

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    setSuccess(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_MB} MB. Comprímelo o divídelo.`)
      return
    }
    startTransition(async () => {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ""
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!)
      }
      const bytesBase64 = btoa(binary)
      const result = await subirInsumoMediaContacto({
        clienteId: asset.clienteId,
        assetEjecutadoId: asset.id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        bytesBase64,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(
        `Listo, recibimos «${file.name}». El equipo de Colombia Tech lo revisará.`,
      )
      router.refresh()
    })
  }

  const handleDownload = (insumoId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await firmarDescargaInsumoMediaContacto({
        insumoId,
        claimedClienteId: asset.clienteId,
      })
      if (result.error || !result.signedUrl) {
        setError(result.error ?? "No se pudo descargar.")
        return
      }
      window.open(result.signedUrl, "_blank", "noopener,noreferrer")
    })
  }

  return (
    <div className="rounded-xl border border-border bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{titulo}</p>
          <p className="text-xs text-muted-foreground">
            {n(asset.costoCreditos)} créditos{" "}
            {piezaEjecutada(asset.estado) ? "usados" : "asignados"}
            {creada ? ` · planeada el ${creada}` : ""}
            {entregada ? ` · entregada el ${entregada}` : ""}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={estado.esTurnoCliente ? "default" : "secondary"}>
            {estado.label}
          </Badge>
          <p className="mt-1 max-w-56 text-xs text-muted-foreground">
            {estado.quienActua}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Qué necesitamos
        </p>
        {hayInstrucciones ? (
          <div className="mt-1 space-y-1">
            {asset.instrucciones ? (
              <p className="whitespace-pre-line">{asset.instrucciones}</p>
            ) : null}
            {asset.formato ? (
              <p>
                <span className="text-muted-foreground">Formato: </span>
                {asset.formato}
              </p>
            ) : null}
            {fechaLimite ? (
              <p>
                <span className="text-muted-foreground">Enviar antes del </span>
                <span className="font-medium">{fechaLimite}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">
            Colombia Tech te indicará qué archivos necesita esta pieza.
          </p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tus archivos
        </p>
        <ul className="mt-1 space-y-1 text-sm">
          {asset.insumos.length === 0 ? (
            <li className="text-muted-foreground">Aún no has subido archivos.</li>
          ) : (
            asset.insumos.map((insumo) => (
              <li
                key={insumo.id}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  {insumo.nombreArchivo}
                  {formatDateTime(insumo.createdAt) ? (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {formatDateTime(insumo.createdAt)}
                    </span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleDownload(insumo.id)}
                  aria-label={`Descargar ${insumo.nombreArchivo}`}
                >
                  Descargar
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label={`Subir archivo para ${titulo}`}
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          aria-label={`Subir archivo para ${titulo}`}
        >
          {pending ? "Subiendo…" : "Subir archivo"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {asset.formato ? `${asset.formato} · ` : ""}máx. {MAX_MB} MB
        </span>
      </div>
      {success ? (
        <p className="mt-2 text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
