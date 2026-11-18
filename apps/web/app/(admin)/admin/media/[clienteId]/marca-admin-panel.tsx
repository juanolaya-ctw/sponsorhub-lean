"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_INSUMOS_BUCKET } from "@/lib/media/media-insumos";
import { TIPOS_MARCA, type TipoMarca } from "@/lib/media/insumos-marca";
import {
  eliminarInsumoMarcaAdmin,
  finalizarSubidaMarcaAdmin,
  prepararSubidaMarcaAdmin,
} from "../actions";

export type MarcaAdminItem = {
  id: string;
  tipo: TipoMarca;
  nombreArchivo: string;
  createdAt: string;
  viewUrl: string | null;
  /** Versiones anteriores del mismo tipo (historial). */
  anteriores: number;
};

function formatFecha(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

export function MarcaAdminPanel({
  clienteId,
  ready,
  items,
  pedidosPorTipo,
}: {
  clienteId: string;
  ready: boolean;
  items: MarcaAdminItem[];
  /** Nº de piezas del ciclo actual que piden cada tipo. */
  pedidosPorTipo: Partial<Record<TipoMarca, number>>;
}) {
  if (!ready) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-white p-4">
        <h2 className="font-semibold">Archivos de marca</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente activar (migración 0027). Hasta entonces el cliente sube
          logos y manual en cada pieza.
        </p>
      </section>
    );
  }
  const byTipo = new Map(items.map((i) => [i.tipo, i]));

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <h2 className="font-semibold">Archivos de marca</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Se cargan una vez por empresa y aparecen como «Cargado» en todas las
        piezas que los piden.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {TIPOS_MARCA.map((t) => (
          <MarcaRow
            key={t.tipo}
            clienteId={clienteId}
            tipo={t.tipo}
            label={t.label}
            item={byTipo.get(t.tipo) ?? null}
            pedidos={pedidosPorTipo[t.tipo] ?? 0}
          />
        ))}
      </ul>
    </section>
  );
}

function MarcaRow({
  clienteId,
  tipo,
  label,
  item,
  pedidos,
}: {
  clienteId: string;
  tipo: TipoMarca;
  label: string;
  item: MarcaAdminItem | null;
  pedidos: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const prepared = await prepararSubidaMarcaAdmin(clienteId, tipo, file.name);
      if (!prepared.data || prepared.error) {
        setError(prepared.error ?? "No se pudo preparar la subida.");
        return;
      }
      const { error: uploadError } = await createClient()
        .storage.from(MEDIA_INSUMOS_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, {
          contentType: file.type || undefined,
        });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const result = await finalizarSubidaMarcaAdmin(
        clienteId,
        tipo,
        prepared.data.path,
        file.name,
      );
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!item) return;
    if (!window.confirm(`¿Eliminar ${item.nombreArchivo}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarInsumoMarcaAdmin(item.id, clienteId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {label}
          {pedidos > 0 ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              lo piden {pedidos} {pedidos === 1 ? "pieza" : "piezas"}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item
            ? `${item.nombreArchivo} · ${formatFecha(item.createdAt)}${item.anteriores > 0 ? ` · ${item.anteriores} versión(es) anterior(es)` : ""}`
            : "Sin cargar"}
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="flex items-center gap-1">
        {item ? (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Cargado
          </span>
        ) : null}
        {item?.viewUrl ? (
          <Button asChild size="sm" variant="ghost">
            <a href={item.viewUrl} target="_blank" rel="noreferrer">
              Ver
            </a>
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label={`Subir ${label}`}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "…" : item ? "Reemplazar" : "Subir"}
        </Button>
        {item ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={remove}
          >
            Eliminar
          </Button>
        ) : null}
      </div>
    </li>
  );
}
