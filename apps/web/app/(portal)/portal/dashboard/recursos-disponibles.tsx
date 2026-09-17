import { DownloadButton } from "./download-button";

export type ArchivoCT = {
  id: string;
  nombre_archivo: string;
  storage_path: string;
  tipo: string;
};

export function RecursosDisponibles({ archivos }: { archivos: ArchivoCT[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Entregables de ColombiaTech</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Archivos que el equipo de ColombiaTech preparó para ti.
      </p>
      <div className="mt-4 rounded-xl border border-border bg-white p-5">
        <ul className="divide-y divide-border">
          {archivos.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              CT aún no ha publicado archivos.
            </li>
          ) : (
            archivos.map((archivo) => (
              <li key={archivo.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{archivo.nombre_archivo}</p>
                  <p className="text-xs text-muted-foreground">{archivo.tipo}</p>
                </div>
                <DownloadButton
                  path={archivo.storage_path}
                  filename={archivo.nombre_archivo}
                />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
