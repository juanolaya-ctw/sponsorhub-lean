"use client";

import { DownloadButton } from "../../dashboard/download-button";
import { Button } from "@/components/ui/button";

type DeckArchivo = {
  id: string;
  nombre: string;
  storagePath: string;
  viewUrl: string | null;
};

export function AddonDeck({ archivos }: { archivos: DeckArchivo[] }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="font-semibold">Deck de add-ons</h2>
      {archivos.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          El equipo de ColombiaTech subirá el deck de add-ons disponibles para
          tu paquete. Te notificaremos cuando esté listo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {archivos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <p className="min-w-0 flex-1 truncate font-medium">
                {archivo.nombre}
              </p>
              <div className="flex items-center gap-2">
                {archivo.viewUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={archivo.viewUrl} target="_blank" rel="noreferrer">
                      Ver deck
                    </a>
                  </Button>
                ) : null}
                <DownloadButton
                  path={archivo.storagePath}
                  filename={archivo.nombre}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
