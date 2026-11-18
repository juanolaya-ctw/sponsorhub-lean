"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { MEDIA_INSUMOS_BUCKET } from "@/lib/media/media-insumos"
import {
  estadoCliente,
  formatFechaCorta,
  estadoFechaLimite,
  fechaPlaneadaVisible,
  formatUsdTarifa,
  hoyBogota,
  type EstadoFechaLimite,
  piezaEjecutada,
  type AssetEstadoCliente,
  type ResumenSaldo,
} from "@/lib/media/portal-cliente"
import {
  TIPOS_MARCA,
  clasificarChecklist,
  labelTipoMarca,
  piezaEsperaAlCliente,
  ultimoPorTipo,
  type ArchivoMarca,
  type ItemChecklist,
  type TipoMarca,
} from "@/lib/media/insumos-marca"
import {
  finalizarSubidaMarcaContacto,
  firmarDescargaInsumoMarcaContacto,
  firmarDescargaInsumoMediaContacto,
  prepararSubidaMarcaContacto,
  finalizarSubidaInsumoPieza,
  prepararSubidaInsumoPieza,
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
  fechaPlaneada: string | null
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

type MarcaCtx = {
  ready: boolean
  /** clienteId → último archivo por tipo */
  porCliente: Map<string, Map<TipoMarca, ArchivoMarca>>
}

function itemsDePieza(asset: ContactoMediaAsset, marca: MarcaCtx): ItemChecklist[] {
  const cargados = marca.porCliente.get(asset.clienteId) ?? new Map()
  const items = clasificarChecklist(asset.instrucciones, cargados)
  // Sin la tabla de marca activa, todo se muestra como ítem normal.
  return marca.ready
    ? items
    : items.map((i) => ({ texto: i.texto, tipo: null, cargado: null }))
}

export function ContactoMediaView({
  ready,
  empresas,
  cycles,
  marcaReady = false,
  marcaPorCliente = {},
  hoy,
}: {
  ready: boolean
  empresas: { id: string; nombre: string }[]
  cycles: ContactoMediaCycle[]
  marcaReady?: boolean
  marcaPorCliente?: Record<string, ArchivoMarca[]>
  /** Hoy en Bogotá (AAAA-MM-DD), calculado en el servidor. */
  hoy?: string
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
  const marca: MarcaCtx = {
    ready: marcaReady,
    porCliente: new Map(
      empresas.map((e) => [e.id, ultimoPorTipo(marcaPorCliente[e.id] ?? [])]),
    ),
  }

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
        <>
          {marcaReady
            ? empresas.map((e) => (
                <MarcaSection
                  key={e.id}
                  clienteId={e.id}
                  empresaNombre={empresas.length > 1 ? e.nombre : null}
                  cargados={marca.porCliente.get(e.id) ?? new Map()}
                  tiposPedidos={tiposPedidosPorCliente(cycles, marca, e.id)}
                />
              ))
            : null}
          {cycles.map((cycle) => (
            <CycleSection
              key={cycle.id}
              cycle={cycle}
              marca={marca}
              hoy={hoy ?? hoyBogota()}
            />
          ))}
        </>
      )}
    </main>
  )
}

function tiposPedidosPorCliente(
  cycles: ContactoMediaCycle[],
  marca: MarcaCtx,
  clienteId: string,
): Set<TipoMarca> {
  const out = new Set<TipoMarca>()
  for (const c of cycles) {
    for (const a of c.assets) {
      if (a.clienteId !== clienteId) continue
      for (const i of itemsDePieza(a, marca)) if (i.tipo) out.add(i.tipo)
    }
  }
  return out
}

function CycleSection({
  cycle,
  marca,
  hoy,
}: {
  cycle: ContactoMediaCycle
  marca: MarcaCtx
  hoy: string
}) {
  const { saldo } = cycle
  const piezas = cycle.assets.map((asset) => {
    const items = itemsDePieza(asset, marca)
    return {
      asset,
      items,
      espera: piezaEsperaAlCliente({
        estado: asset.estado,
        items,
        archivosPieza: asset.insumos.length,
      }),
    }
  })
  const pendientesTuyas = piezas.filter((p) => p.espera).length
  const vencidas = piezas.filter(
    (p) => p.espera && estadoFechaLimite(p.asset.fechaLimite, hoy) === "vencida",
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
          {vencidas > 0 ? (
            <p className="mt-1 text-amber-800">
              {vencidas === 1
                ? "En 1 pieza ya pasó la fecha sugerida de entrega."
                : `En ${vencidas} piezas ya pasó la fecha sugerida de entrega.`}{" "}
              Súbelos apenas puedas para no retrasarlas.
            </p>
          ) : null}
          <p className="mt-1 text-muted-foreground">
            {marca.ready
              ? "Tus archivos de marca (logos, manual…) se suben una sola vez y sirven para todas tus piezas. "
              : ""}
            Sube en cada pieza solo lo que es propio de esa pieza (máx. {MAX_MB}{" "}
            MB por archivo). Subir un archivo no aprueba la pieza: el equipo de
            Colombia Tech lo revisa y actualiza el estado.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aún no hay piezas planeadas en este periodo.
        </p>
      )}

      <div className="space-y-3">
        {piezas.map(({ asset, items, espera }) => (
          <AssetInsumosCard
            key={asset.id}
            asset={asset}
            items={items}
            espera={espera}
            hoy={hoy}
          />
        ))}
      </div>
    </section>
  )
}

function AssetInsumosCard({
  asset,
  items,
  espera,
  hoy,
}: {
  asset: ContactoMediaAsset
  items: ItemChecklist[]
  espera: boolean
  hoy: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const estadoBase = estadoCliente(asset.estado)
  // Si solo faltaban insumos de marca ya cargados, no insistir al cliente.
  const estado =
    asset.estado === "pendiente_insumos" && !espera
      ? {
          ...estadoBase,
          esTurnoCliente: false,
          quienActua:
            "Ya tenemos lo necesario de tu parte. Colombia Tech revisa y actualiza el estado.",
        }
      : estadoBase
  const titulo = `#${asset.numero} · ${asset.nombre}`
  const fechaLimite = formatFechaCorta(asset.fechaLimite)
  const estadoLimite = estadoFechaLimite(asset.fechaLimite, hoy)
  const planeada = formatFechaCorta(fechaPlaneadaVisible(asset.fechaPlaneada, hoy))
  const entregada = formatDateTime(asset.entregadaEl)
  const hayInstrucciones = Boolean(asset.instrucciones || asset.formato)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    setSuccess(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo pesa más de ${MAX_MB} MB. Comprímelo o divídelo.`)
      return
    }
    startTransition(async () => {
      const prepared = await prepararSubidaInsumoPieza({
        clienteId: asset.clienteId,
        assetEjecutadoId: asset.id,
        filename: file.name,
      })
      if (!prepared.data || prepared.error) {
        setError(prepared.error ?? "No se pudo preparar la subida.")
        return
      }
      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_INSUMOS_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
          contentType: file.type || undefined,
        })
      if (uploadError) {
        setError(uploadError.message)
        return
      }
      const result = await finalizarSubidaInsumoPieza({
        clienteId: asset.clienteId,
        assetEjecutadoId: asset.id,
        storagePath: prepared.data.path,
        filename: file.name,
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
            {planeada && !entregada ? ` · publicación prevista: ${planeada}` : ""}
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

      {fechaLimite ? (
        <FechaLimiteBanner
          fecha={fechaLimite}
          estado={estadoLimite}
          espera={espera}
        />
      ) : null}

      <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Qué necesitamos
        </p>
        {hayInstrucciones ? (
          <div className="mt-1 space-y-1">
            {asset.instrucciones ? (
              <ChecklistPieza items={items} clienteId={asset.clienteId} />
            ) : null}
            {asset.formato ? (
              <p>
                <span className="text-muted-foreground">Formato: </span>
                {asset.formato}
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
          Archivos de esta pieza
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

function ChecklistPieza({
  items,
  clienteId,
}: {
  items: ItemChecklist[]
  clienteId: string
}) {
  if (items.length === 0) return null
  if (items.length === 1 && items[0]!.tipo === null) {
    return <p className="whitespace-pre-line">{items[0]!.texto}</p>
  }
  return (
    <ul className="space-y-1">
      {items.map((item, i) =>
        item.tipo === null ? (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground">•</span>
            <span>{item.texto}</span>
          </li>
        ) : (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span aria-hidden className={item.cargado ? "text-emerald-700" : "text-muted-foreground"}>
              {item.cargado ? "✓" : "•"}
            </span>
            <span>{item.texto}</span>
            {item.cargado ? (
              <>
                <CargadoBadge />
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(item.cargado.createdAt)} · de tus archivos de marca
                </span>
                <VerArchivoMarcaButton archivo={item.cargado} />
              </>
            ) : (
              <SubirMarcaButton
                clienteId={clienteId}
                tipo={item.tipo}
                label="Subir (sirve para todas tus piezas)"
              />
            )}
          </li>
        ),
      )}
    </ul>
  )
}

/** Mismo badge que eventos (portal/recursos/cargado-badge.tsx). */
function CargadoBadge() {
  return (
    <span className="shrink-0 rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Cargado
    </span>
  )
}

function MarcaSection({
  clienteId,
  empresaNombre,
  cargados,
  tiposPedidos,
}: {
  clienteId: string
  empresaNombre: string | null
  cargados: Map<TipoMarca, ArchivoMarca>
  tiposPedidos: Set<TipoMarca>
}) {
  const tipos = TIPOS_MARCA.filter(
    (t) => tiposPedidos.has(t.tipo) || cargados.has(t.tipo),
  )
  if (tipos.length === 0) return null
  const faltan = tipos.filter((t) => !cargados.has(t.tipo)).length

  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <h2 className="font-semibold">
        Archivos de tu marca{empresaNombre ? ` · ${empresaNombre}` : ""}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Súbelos una sola vez: los usamos en todas las piezas que los necesitan.
        {faltan > 0
          ? ` Te ${faltan === 1 ? "falta 1" : `faltan ${faltan}`}.`
          : " Ya están todos cargados."}
      </p>
      <ul className="mt-4 divide-y divide-border">
        {tipos.map((t) => {
          const archivo = cargados.get(t.tipo) ?? null
          return (
            <li key={t.tipo} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {archivo
                    ? `${archivo.nombreArchivo} · ${formatDateTime(archivo.createdAt) ?? ""}`
                    : "Pendiente"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {archivo ? (
                  <>
                    <CargadoBadge />
                    <VerArchivoMarcaButton archivo={archivo} />
                  </>
                ) : null}
                <SubirMarcaButton
                  clienteId={clienteId}
                  tipo={t.tipo}
                  label={archivo ? "Reemplazar" : "Subir"}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function VerArchivoMarcaButton({ archivo }: { archivo: ArchivoMarca }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Ver ${archivo.nombreArchivo}`}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await firmarDescargaInsumoMarcaContacto({ archivoId: archivo.id })
            if (result.error || !result.signedUrl) {
              setError(result.error ?? "No se pudo abrir.")
              return
            }
            window.open(result.signedUrl, "_blank", "noopener,noreferrer")
          })
        }
      >
        Ver archivo
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </>
  )
}

function SubirMarcaButton({
  clienteId,
  tipo,
  label,
}: {
  clienteId: string
  tipo: TipoMarca
  label: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setMsg(null)
    if (file.size > MAX_MB * 1024 * 1024) {
      setMsg({ ok: false, text: `Pesa más de ${MAX_MB} MB.` })
      return
    }
    startTransition(async () => {
      const prepared = await prepararSubidaMarcaContacto({
        clienteId,
        tipo,
        filename: file.name,
      })
      if (!prepared.data || prepared.error) {
        setMsg({ ok: false, text: prepared.error ?? "No se pudo preparar la subida." })
        return
      }
      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_INSUMOS_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
          contentType: file.type || undefined,
        })
      if (uploadError) {
        setMsg({ ok: false, text: uploadError.message })
        return
      }
      const result = await finalizarSubidaMarcaContacto({
        clienteId,
        tipo,
        storagePath: prepared.data.path,
        filename: file.name,
      })
      if (result.error) {
        setMsg({ ok: false, text: result.error })
        return
      }
      setMsg({
        ok: true,
        text: `Listo: ${labelTipoMarca(tipo)} cargado para todas tus piezas.`,
      })
      router.refresh()
    })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label={`Subir ${labelTipoMarca(tipo)}`}
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
      >
        {pending ? "Subiendo…" : label}
      </Button>
      {msg ? (
        <span
          className={msg.ok ? "text-xs text-green-700" : "text-xs text-destructive"}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.text}
        </span>
      ) : null}
    </>
  )
}

function FechaLimiteBanner({
  fecha,
  estado,
  espera,
}: {
  fecha: string
  estado: EstadoFechaLimite | null
  espera: boolean
}) {
  if (!espera) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Fecha límite de tus archivos: {fecha}
      </p>
    )
  }
  if (estado === "vencida") {
    return (
      <div
        className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        role="status"
      >
        <p className="font-medium">La fecha para entregar tus archivos era el {fecha}.</p>
        <p className="mt-0.5">Súbelos apenas puedas para no retrasar la pieza.</p>
      </div>
    )
  }
  return (
    <div className="mt-3 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm">
      <p className="font-medium">
        {estado === "hoy"
          ? `Entrega tus archivos hoy (${fecha}).`
          : `Entrega tus archivos antes del ${fecha}.`}
      </p>
    </div>
  )
}
