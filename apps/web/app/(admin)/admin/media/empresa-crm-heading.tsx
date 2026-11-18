import { toEmpresaCrmView, type MediaClienteLegacyRow } from "@/lib/media/empresa-contactos"

export function EmpresaCrmHeading({
  cliente,
}: {
  cliente: MediaClienteLegacyRow
}) {
  const view = toEmpresaCrmView(cliente)

  return (
    <div>
      <h1 className="text-xl font-semibold">{view.empresaNombre}</h1>
      <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {view.contactos.length > 0 ? (
          <p>
            Contacto en fila:{" "}
            <span className="text-foreground">{view.contactos[0]?.nombre}</span>
            {view.dudas.includes("nombre_puede_ser_contacto_sin_confirmar")
              ? " (por confirmar)"
              : null}
          </p>
        ) : (
          <p>Sin contacto etiquetado en fila</p>
        )}
        {view.filaEmpresa.email || view.filaEmpresa.telefono ? (
          <p>
            Datos en fila empresa
            {view.filaEmpresa.email ? `: ${view.filaEmpresa.email}` : ""}
            {view.filaEmpresa.email && view.filaEmpresa.telefono ? " · " : ""}
            {view.filaEmpresa.telefono ?? ""}
            <span className="block text-xs">
              Sin asignar a un contacto hasta el backfill aprobado
            </span>
          </p>
        ) : null}
        {view.dudas.includes("nombre_contiene_ampersand_no_dividir_sin_decision") ? (
          <p className="text-xs">
            El nombre contiene &amp;: no se divide en varios contactos sin
            decisión.
          </p>
        ) : null}
      </div>
    </div>
  )
}
