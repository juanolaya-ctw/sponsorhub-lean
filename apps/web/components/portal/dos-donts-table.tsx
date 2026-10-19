import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getDosDontsTablas,
  type DosDontsVariante,
} from "@/lib/portal/dos-donts"

export function DosDontsTable({
  variante,
  className,
}: {
  variante: DosDontsVariante
  className?: string
}) {
  const tablas = getDosDontsTablas(variante)

  return (
    <div className={className ?? "space-y-4"}>
      <h3 className="text-sm font-semibold">Do&apos;s and Don&apos;ts</h3>
      {tablas.map((tabla) => (
        <div key={tabla.titulo ?? "dos-donts"} className="space-y-2">
          {tabla.titulo ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tabla.titulo}
            </p>
          ) : null}
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-1/2 bg-emerald-50/80 text-emerald-950">
                    Sí (Do)
                  </TableHead>
                  <TableHead className="w-1/2 bg-red-50/80 text-red-950">
                    No (Don&apos;t)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabla.filas.map((fila) => (
                  <TableRow key={`${fila.do.slice(0, 40)}-${fila.dont.slice(0, 40)}`}>
                    <TableCell className="align-top text-sm leading-relaxed">
                      {fila.do}
                    </TableCell>
                    <TableCell className="align-top text-sm leading-relaxed">
                      {fila.dont}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}
