import { FileDown } from "lucide-react";
import { DownloadButton } from "./download-button";

export type ArchivoCT = {
  id: string;
  nombre_archivo: string;
  storage_path: string;
};

export function RecursosDisponibles({ archivos }: { archivos: ArchivoCT[] }) {
  if (archivos.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-semibold">Recursos disponibles</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {archivos.map((archivo) => (
          <article
            key={archivo.id}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-white p-4"
          >
            <FileDown className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 truncate font-medium" title={archivo.nombre_archivo}>
              {archivo.nombre_archivo}
            </p>
            <div className="mt-4">
              <DownloadButton
                path={archivo.storage_path}
                filename={archivo.nombre_archivo}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
