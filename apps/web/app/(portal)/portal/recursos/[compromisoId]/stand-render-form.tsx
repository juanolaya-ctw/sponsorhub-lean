"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { responderStandRender } from "./stand-actions";

export type StandRenderView = {
  id: string;
  nombre: string;
  viewUrl: string | null;
};

type StandRevisionView = {
  id: string;
  decision: "aprobado" | "cambios_solicitados";
  comentario: string | null;
  created_at: string;
};

function isImageName(name: string) {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
}

export function StandRenderForm({
  compromisoId,
  renders,
  revision,
}: {
  compromisoId: string;
  renders: StandRenderView[];
  revision: StandRevisionView | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    renders[0]?.id ?? null,
  );
  const [mode, setMode] = useState<"idle" | "aprobar" | "cambios">("idle");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected =
    renders.find((item) => item.id === selectedId) ?? renders[0] ?? null;
  const selectedIndex = selected
    ? renders.findIndex((item) => item.id === selected.id)
    : -1;
  const aprobado = revision?.decision === "aprobado";
  const cambios = revision?.decision === "cambios_solicitados";

  function submit(decision: "aprobado" | "cambios_solicitados") {
    setError(null);
    startTransition(async () => {
      const result = await responderStandRender({
        compromisoId,
        decision,
        comentario,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMode("idle");
      setComentario("");
      router.refresh();
    });
  }

  if (renders.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold">Renders del stand</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          El equipo de ColombiaTech aún no ha cargado los renders. Te
          avisaremos cuando estén listos para tu revisión.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {aprobado ? (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Stand aprobado</p>
          {revision?.comentario ? (
            <p className="mt-1 whitespace-pre-wrap">{revision.comentario}</p>
          ) : (
            <p className="mt-1 text-emerald-900/80">
              Confirmaste el diseño del stand.
            </p>
          )}
        </div>
      ) : null}

      {cambios ? (
        <div className="rounded-xl border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Cambios solicitados</p>
          {revision?.comentario ? (
            <p className="mt-1 whitespace-pre-wrap">{revision.comentario}</p>
          ) : null}
          <p className="mt-2 text-amber-900/80">
            Cuando CS suba una nueva versión, podrás volver a revisar aquí.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Renders del stand</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {renders.length}{" "}
            {renders.length === 1 ? "imagen" : "imágenes"} · haz clic para
            ampliar
            {selectedIndex >= 0
              ? ` · viendo ${selectedIndex + 1} de ${renders.length}`
              : ""}
          </p>
        </div>

        <div className="bg-neutral-950 px-3 py-4 sm:px-5">
          {selected?.viewUrl && isImageName(selected.nombre) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.viewUrl}
              alt={selected.nombre}
              className="mx-auto max-h-[70vh] w-full object-contain"
            />
          ) : selected?.viewUrl ? (
            <a
              href={selected.viewUrl}
              target="_blank"
              rel="noreferrer"
              className="block py-16 text-center text-sm text-white underline"
            >
              Abrir {selected.nombre}
            </a>
          ) : (
            <p className="py-16 text-center text-sm text-neutral-400">
              No se pudo cargar la vista previa.
            </p>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-border p-3">
          {renders.map((archivo, index) => {
            const active = archivo.id === selected?.id;
            return (
              <button
                key={archivo.id}
                type="button"
                onClick={() => setSelectedId(archivo.id)}
                className={
                  active
                    ? "relative shrink-0 overflow-hidden rounded-lg ring-2 ring-foreground"
                    : "relative shrink-0 overflow-hidden rounded-lg ring-1 ring-border hover:ring-foreground/40"
                }
                aria-label={`Ver render ${index + 1}: ${archivo.nombre}`}
              >
                {archivo.viewUrl && isImageName(archivo.nombre) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={archivo.viewUrl}
                    alt=""
                    className="size-16 object-cover sm:size-20"
                  />
                ) : (
                  <span className="flex size-16 items-center justify-center bg-muted text-xs sm:size-20">
                    {index + 1}
                  </span>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[10px] text-white">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!aprobado ? (
        <div className="rounded-xl border border-border bg-white p-5">
          <h2 className="text-sm font-semibold">Tu decisión</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Si pides cambios, indica el número del render (1, 2, 3…) y qué
            ajustar.
          </p>

          {mode === "idle" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  setMode("aprobar");
                  setError(null);
                }}
              >
                <Check data-icon="inline-start" />
                Aprobar stand
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode("cambios");
                  setError(null);
                }}
              >
                <MessageSquareWarning data-icon="inline-start" />
                Solicitar cambios
              </Button>
            </div>
          ) : null}

          {mode === "aprobar" ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="stand-comentario-ok">
                  Comentario (opcional)
                </Label>
                <Textarea
                  id="stand-comentario-ok"
                  value={comentario}
                  onChange={(event) => setComentario(event.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Ej. Nos gusta la vista frontal; adelante con producción."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("aprobado")}
                >
                  {pending ? "Enviando…" : "Confirmar aprobación"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setMode("idle");
                    setComentario("");
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {mode === "cambios" ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="stand-comentario-cambios">
                  ¿Qué hay que cambiar?
                </Label>
                <Textarea
                  id="stand-comentario-cambios"
                  value={comentario}
                  onChange={(event) => setComentario(event.target.value)}
                  rows={5}
                  required
                  className="mt-1"
                  placeholder={
                    "Ej. En el render 1: agrandar el logo.\nEn el render 2: cambiar el color del backdrop a navy."
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => submit("cambios_solicitados")}
                >
                  {pending ? "Enviando…" : "Enviar comentarios"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setMode("idle");
                    setComentario("");
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
