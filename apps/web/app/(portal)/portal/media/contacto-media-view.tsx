"use client"

import { useRef, useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  firmarDescargaInsumoMediaContacto,
  subirInsumoMediaContacto,
} from "./contacto-insumos-actions"

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado"

const ESTADO_LABELS: Record<AssetEstado, string> = {
  pendiente_insumos: "Pendiente insumos",
  insumos_recibidos: "Insumos recibidos",
  en_ejecucion: "En ejecución",
  entregado: "Entregado",
  aprobado: "Aprobado",
}

export type ContactoMediaAsset = {
  id: string
  nombre: string
  estado: AssetEstado
  costoCreditos: number
  clienteId: string
  insumos: {
    id: string
    nombreArchivo: string
    createdAt: string
  }[]
}

export type ContactoMediaCycle = {
  id: string
  label: string
  disponibles: number
  /** Pool del ciclo: asignados + extra + rollover (denominador de UI). */
  creditosTotales: number
  /** Solo base del ciclo; no usar como total de UI. */
  asignados: number
  usados: number
  assets: ContactoMediaAsset[]
}

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
          El acceso de contactos a empresas e insumos aún no está activado
          (migración 0024 pendiente). El esquema vigente del portal sponsor
          sigue operativo.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Media</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Empresas autorizadas, ciclos (incl. cliente-only), saldo y piezas.
          Puedes cargar insumos por pieza; no se aprueba ni cambia estado solo
          al subir.
        </p>
        <p className="mt-2 text-sm text-foreground">
          {empresas.map((e) => e.nombre).join(" · ") || "Sin empresas"}
        </p>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">Sin ciclos visibles</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando CT active un acuerdo para tu empresa, aparecerá aquí.
          </p>
        </div>
      ) : (
        cycles.map((cycle) => (
          <section key={cycle.id} className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-6">
              <p className="text-sm text-muted-foreground">{cycle.label}</p>
              <p className="mt-1 text-4xl font-bold">{cycle.disponibles}</p>
              <p className="text-sm text-muted-foreground">
                créditos disponibles de {cycle.creditosTotales} · usados{" "}
                {cycle.usados}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Los créditos usados incluyen piezas pendientes de insumos; subir
                archivo no cambia el estado de la pieza.
              </p>
            </div>
            <div className="space-y-3">
              {cycle.assets.map((asset) => (
                <AssetInsumosCard key={asset.id} asset={asset} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  )
}

function AssetInsumosCard({ asset }: { asset: ContactoMediaAsset }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
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
      window.location.reload()
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
    <div className="rounded-xl border border-border bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{asset.nombre}</p>
          <p className="text-xs text-muted-foreground">
            {asset.costoCreditos} créditos
          </p>
        </div>
        <Badge>{ESTADO_LABELS[asset.estado]}</Badge>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {asset.insumos.length === 0 ? (
          <li className="text-muted-foreground">Sin insumos cargados</li>
        ) : (
          asset.insumos.map((insumo) => (
            <li key={insumo.id} className="flex items-center justify-between gap-2">
              <span>{insumo.nombreArchivo}</span>
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

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label={`Subir insumo para ${asset.nombre}`}
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
          aria-label={`Cargar insumo para ${asset.nombre}`}
        >
          {pending ? "Subiendo…" : "Cargar insumo"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Solo entrega de archivo; no cambia el estado de la pieza.
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
