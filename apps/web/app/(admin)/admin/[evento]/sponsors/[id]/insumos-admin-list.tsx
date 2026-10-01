"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArchivoActions } from "./archivo-actions";
import {
  isStoredObject,
  parseLinkedInInstagram,
  parseNewsletter,
  TIPO_LINKEDIN_INSTAGRAM,
  TIPO_NEWSLETTER,
} from "@/lib/portal/beneficios";
import {
  insumoKeyFromTipo,
  labelInsumoFromTipo,
  INSUMOS_REQUERIDOS,
} from "@/lib/portal/insumos";

export type InsumoArchivoAdmin = {
  id: string;
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  created_at: string;
  compromiso_id: string | null;
  realFile: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
};

const INSUMO_LABEL = new Map(
  INSUMOS_REQUERIDOS.map((insumo) => [insumo.key, insumo.nombre]),
);

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelTipo(tipo: string) {
  return (
    INSUMO_LABEL.get(insumoKeyFromTipo(tipo) ?? "") ?? labelInsumoFromTipo(tipo)
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copiado" : "Copiar textos"}
    </Button>
  );
}

function ExpandHeader({
  open,
  onToggle,
  title,
  subtitle,
  badge,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
    >
      <span className="mt-0.5 text-muted-foreground">
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function NewsletterCard({
  archivo,
  sponsorId,
  eventoSlug,
}: {
  archivo: InsumoArchivoAdmin;
  sponsorId: string;
  eventoSlug: string;
}) {
  const [open, setOpen] = useState(true);
  const payload = parseNewsletter(archivo.nombre_archivo);
  const textsForCopy = payload
    ? [
        `Título: ${payload.titulo}`,
        `Cuerpo: ${payload.cuerpo}`,
        `CTA: ${payload.cta}`,
      ].join("\n\n")
    : "";

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white">
      <ExpandHeader
        open={open}
        onToggle={() => setOpen((value) => !value)}
        title={labelTipo(archivo.tipo)}
        subtitle={formatDateTime(archivo.created_at)}
        badge={payload ? "Texto + imagen" : archivo.realFile ? "Archivo" : "Texto"}
      />
      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {payload ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Contenido editorial</p>
                  <CopyButton text={textsForCopy} />
                </div>
                <Field label="Título" value={payload.titulo} />
                <Field label="Cuerpo" value={payload.cuerpo} />
                <Field label="Link CTA" value={payload.cta} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este registro no tiene textos estructurados (JSON) asociados.
            </p>
          )}

          {archivo.realFile ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Imagen</p>
              {archivo.viewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={archivo.viewUrl}
                  alt="Imagen del newsletter"
                  className="max-h-56 rounded-lg border border-border object-contain"
                />
              ) : null}
            </div>
          ) : null}

          <ArchivoActions
            archivoId={archivo.id}
            sponsorId={sponsorId}
            eventoSlug={eventoSlug}
            nombre={
              payload
                ? `newsletter-${archivo.id}.png`
                : archivo.nombre_archivo
            }
            storagePath={archivo.storage_path}
            viewUrl={archivo.viewUrl}
            downloadUrl={archivo.downloadUrl}
            realFile={archivo.realFile}
          />
        </div>
      ) : null}
    </article>
  );
}

function LinkedInCard({
  meta,
  imagenes,
  sponsorId,
  eventoSlug,
}: {
  meta: InsumoArchivoAdmin | null;
  imagenes: InsumoArchivoAdmin[];
  sponsorId: string;
  eventoSlug: string;
}) {
  const [open, setOpen] = useState(true);
  const payload = meta ? parseLinkedInInstagram(meta.nombre_archivo) : null;
  const latest = meta ?? imagenes[0];
  const textsForCopy = payload
    ? [
        `Dato impactante: ${payload.dato_impactante}`,
        `Párrafo 1: ${payload.parrafo1}`,
        `Párrafo 2: ${payload.parrafo2}`,
        payload.parrafo3 ? `Párrafo 3: ${payload.parrafo3}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white">
      <ExpandHeader
        open={open}
        onToggle={() => setOpen((value) => !value)}
        title="Contenido LinkedIn + Instagram"
        subtitle={
          latest ? formatDateTime(latest.created_at) : undefined
        }
        badge={`${payload ? "Textos" : "Sin textos"} · ${imagenes.length} imagen${imagenes.length === 1 ? "" : "es"}`}
      />
      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {payload ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Textos para piezas</p>
                <CopyButton text={textsForCopy} />
              </div>
              <Field label="Dato impactante" value={payload.dato_impactante} />
              <Field label="Párrafo 1 — Contexto" value={payload.parrafo1} />
              <Field label="Párrafo 2 — Impacto" value={payload.parrafo2} />
              {payload.parrafo3 ? (
                <Field
                  label="Párrafo 3 — Mensaje al ecosistema"
                  value={payload.parrafo3}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay textos guardados para este beneficio.
            </p>
          )}

          {imagenes.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Imágenes</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {imagenes.map((imagen) => (
                  <li
                    key={imagen.id}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    {imagen.viewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagen.viewUrl}
                        alt={imagen.nombre_archivo}
                        className="h-40 w-full bg-muted/40 object-contain"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                        {imagen.nombre_archivo}
                      </div>
                    )}
                    <div className="space-y-2 border-t border-border p-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {imagen.nombre_archivo}
                      </p>
                      <ArchivoActions
                        archivoId={imagen.id}
                        sponsorId={sponsorId}
                        eventoSlug={eventoSlug}
                        nombre={imagen.nombre_archivo}
                        storagePath={imagen.storage_path}
                        viewUrl={imagen.viewUrl}
                        downloadUrl={imagen.downloadUrl}
                        realFile={imagen.realFile}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {meta ? (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Registro de textos · {formatDateTime(meta.created_at)}
              </p>
              <ArchivoActions
                archivoId={meta.id}
                sponsorId={sponsorId}
                eventoSlug={eventoSlug}
                nombre={meta.nombre_archivo}
                storagePath={meta.storage_path}
                viewUrl={null}
                downloadUrl={null}
                realFile={false}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SimpleFileCard({
  archivo,
  sponsorId,
  eventoSlug,
}: {
  archivo: InsumoArchivoAdmin;
  sponsorId: string;
  eventoSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const isJson = archivo.nombre_archivo.trim().startsWith("{");
  const previewName = isJson
    ? labelTipo(archivo.tipo)
    : archivo.nombre_archivo;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white">
      <ExpandHeader
        open={open}
        onToggle={() => setOpen((value) => !value)}
        title={labelTipo(archivo.tipo)}
        subtitle={`${previewName} · ${formatDateTime(archivo.created_at)}`}
        badge={archivo.realFile ? "Archivo" : "Contenido"}
      />
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          {!archivo.realFile && !isJson ? (
            <Field label="Contenido" value={archivo.nombre_archivo} />
          ) : null}
          {archivo.realFile && archivo.viewUrl ? (
            /\.(png|jpe?g|webp|gif|svg)$/i.test(archivo.nombre_archivo) ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(archivo.storage_path) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={archivo.viewUrl}
                alt={previewName}
                className="max-h-48 rounded-lg border border-border object-contain"
              />
            ) : null
          ) : null}
          <ArchivoActions
            archivoId={archivo.id}
            sponsorId={sponsorId}
            eventoSlug={eventoSlug}
            nombre={archivo.nombre_archivo}
            storagePath={archivo.storage_path}
            viewUrl={archivo.viewUrl}
            downloadUrl={archivo.downloadUrl}
            realFile={archivo.realFile}
          />
        </div>
      ) : null}
    </article>
  );
}

export function InsumosAdminList({
  archivos,
  sponsorId,
  eventoSlug,
}: {
  archivos: InsumoArchivoAdmin[];
  sponsorId: string;
  eventoSlug: string;
}) {
  const groups = useMemo(() => {
    const newsletters: InsumoArchivoAdmin[] = [];
    const linkedInByKey = new Map<
      string,
      { meta: InsumoArchivoAdmin | null; imagenes: InsumoArchivoAdmin[] }
    >();
    const others: InsumoArchivoAdmin[] = [];

    for (const archivo of archivos) {
      if (archivo.tipo === TIPO_NEWSLETTER) {
        newsletters.push(archivo);
        continue;
      }
      if (archivo.tipo === TIPO_LINKEDIN_INSTAGRAM) {
        const key = archivo.compromiso_id ?? "linkedin_sin_compromiso";
        const current = linkedInByKey.get(key) ?? {
          meta: null,
          imagenes: [],
        };
        if (isStoredObject(archivo.storage_path)) {
          current.imagenes.push(archivo);
        } else {
          current.meta = archivo;
        }
        linkedInByKey.set(key, current);
        continue;
      }
      others.push(archivo);
    }

    return { newsletters, linkedIn: Array.from(linkedInByKey.values()), others };
  }, [archivos]);

  if (archivos.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <p className="font-medium">Este sponsor aún no ha subido insumos</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {groups.newsletters.map((archivo) => (
        <NewsletterCard
          key={archivo.id}
          archivo={archivo}
          sponsorId={sponsorId}
          eventoSlug={eventoSlug}
        />
      ))}
      {groups.linkedIn.map((group, index) => (
        <LinkedInCard
          key={group.meta?.id ?? group.imagenes[0]?.id ?? `li-${index}`}
          meta={group.meta}
          imagenes={group.imagenes}
          sponsorId={sponsorId}
          eventoSlug={eventoSlug}
        />
      ))}
      {groups.others.map((archivo) => (
        <SimpleFileCard
          key={archivo.id}
          archivo={archivo}
          sponsorId={sponsorId}
          eventoSlug={eventoSlug}
        />
      ))}
    </div>
  );
}
