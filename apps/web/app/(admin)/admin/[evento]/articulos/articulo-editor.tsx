"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ARTICULO_CATEGORIAS,
  ARCHIVOS_BUCKET,
  DATO_MAX_CHARS,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  articuloStoragePath,
  eventLogoFallback,
  eventLogoPaths,
  type ArticuloSponsorCard,
  type ArticuloStatus,
  type ImageCrop,
} from "@/lib/admin/articulos";
import {
  capturePreviewNode,
  compressImageForUpload,
  downloadBlob,
  toDataUrl,
} from "@/lib/admin/articulos-image";
import { createClient } from "@/lib/supabase/client";
import { saveArticulo } from "./actions";
import { CropModal } from "./crop-modal";

type LogoVariant = "blanco" | "color";
type EventLogoVariant = "blanco" | "contraste";

export function ArticuloEditor({
  eventoId,
  eventoSlug,
  sponsor,
  onBack,
  onSaved,
}: {
  eventoId: string;
  eventoSlug: string;
  sponsor: ArticuloSponsorCard;
  onBack: () => void;
  onSaved: (card: ArticuloSponsorCard) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const articulo = sponsor.articulo;
  const prefill = !articulo ? sponsor.insumo_prefill : null;

  const [dato, setDato] = useState(
    articulo?.dato_impactante ?? prefill?.dato_impactante ?? "",
  );
  const [copy, setCopy] = useState(
    articulo?.articulo_corto ?? prefill?.articulo_corto ?? "",
  );
  const [categoria, setCategoria] = useState(articulo?.categoria ?? "");
  const [sponsorLogoVariant, setSponsorLogoVariant] =
    useState<LogoVariant>("color");
  const [eventLogoVariant, setEventLogoVariant] =
    useState<EventLogoVariant>("blanco");
  const [eventLogoSrc, setEventLogoSrc] = useState(
    () => eventLogoPaths(eventoSlug).blanco,
  );

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(
    sponsor.image_source_url ??
      sponsor.imagen_preview_url ??
      prefill?.image_url ??
      null,
  );
  /** Path of insumo image already in storage (reuse on first save without re-upload as source). */
  const [insumoImagePath] = useState<string | null>(
    prefill?.image_path ?? null,
  );
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [imageCrop, setImageCrop] = useState<ImageCrop | null>(
    articulo?.image_crop ?? null,
  );
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sponsorLogoUrl, setSponsorLogoUrl] = useState<string | null>(
    sponsor.logo_color_url ?? sponsor.logo_preview_url ?? null,
  );
  const [sponsorLogoBroken, setSponsorLogoBroken] = useState(false);

  useEffect(() => {
    const paths = eventLogoPaths(eventoSlug);
    setEventLogoSrc(
      eventLogoVariant === "blanco" ? paths.blanco : paths.contraste,
    );
  }, [eventoSlug, eventLogoVariant]);

  useEffect(() => {
    const next =
      sponsorLogoVariant === "blanco"
        ? (sponsor.logo_blanco_url ?? sponsor.logo_preview_url)
        : (sponsor.logo_color_url ??
          sponsor.logo_preview_url ??
          sponsor.logo_blanco_url);
    setSponsorLogoUrl(next ?? null);
    setSponsorLogoBroken(false);
  }, [
    sponsorLogoVariant,
    sponsor.logo_blanco_url,
    sponsor.logo_color_url,
    sponsor.logo_preview_url,
  ]);

  const onFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const uploadBlob = async (blob: Blob, path: string) => {
    const supabase = createClient();
    const compressed = await compressImageForUpload(blob);
    const { error: uploadError } = await supabase.storage
      .from(ARCHIVOS_BUCKET)
      .upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  };

  const prepareCapture = useCallback(async () => {
    const root = previewRef.current;
    if (!root) throw new Error("Vista previa no disponible.");
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src) return;
        const dataUrl = await toDataUrl(src);
        if (dataUrl !== src) img.setAttribute("src", dataUrl);
      }),
    );
  }, []);

  const captureFullRes = async (): Promise<Blob> => {
    const root = previewRef.current;
    if (!root) throw new Error("Vista previa no disponible.");
    await prepareCapture();
    const raw = await capturePreviewNode(root, 2);
    return compressImageForUpload(raw);
  };

  async function handleSave(status: ArticuloStatus) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      let imageSourcePath =
        articulo?.image_source_path ?? insumoImagePath ?? null;
      let imagenPath = articulo?.imagen_path ?? null;
      let refreshImagenUrl = false;

      if (sourceBlob) {
        imageSourcePath = await uploadBlob(
          sourceBlob,
          articuloStoragePath(sponsor.id, "source"),
        );
      }

      if (previewImageUrl) {
        const finalBlob = await captureFullRes();
        imagenPath = await uploadBlob(
          finalBlob,
          articuloStoragePath(sponsor.id, "final"),
        );
        refreshImagenUrl = true;
      }

      const result = await saveArticulo({
        eventoId,
        eventoSlug,
        sponsorId: sponsor.id,
        companyName: sponsor.nombre,
        tier: sponsor.paquete,
        logoUrl:
          sponsor.logo_blanco_url ??
          sponsor.logo_preview_url ??
          sponsor.logo_url,
        datoImpactante: dato,
        articuloCorto: copy,
        categoria: categoria || null,
        status,
        existingId: articulo?.id ?? null,
        existingSlug: articulo?.slug ?? null,
        existingPublishedAt: articulo?.published_at ?? null,
        imageSourcePath,
        imagenPath,
        imageCrop,
        refreshImagenUrl: refreshImagenUrl || status === "published",
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSourceBlob(null);
      setMessage(
        status === "published" ? "Artículo publicado." : "Borrador guardado.",
      );
      onSaved({
        ...sponsor,
        articulo: result.articulo,
        image_source_url: previewImageUrl,
        imagen_preview_url: previewImageUrl,
        insumo_prefill: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setError(null);
    try {
      const blob = await captureFullRes();
      downloadBlob(blob, `${sponsor.nombre.replace(/\s+/g, "-")}-1080x1350.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="shrink-0">
          <div
            ref={previewRef}
            style={{
              width: PREVIEW_WIDTH,
              height: PREVIEW_HEIGHT,
              position: "relative",
              overflow: "hidden",
              background: "#1f2937",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImageUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                Sin imagen
              </div>
            )}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 531,
                background:
                  "linear-gradient(180deg, transparent 0%, #131212 70.67%)",
                mixBlendMode: "multiply",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "50px 32px 0",
              }}
            >
              {sponsorLogoUrl && !sponsorLogoBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sponsorLogoUrl}
                  alt={sponsor.nombre}
                  onError={() => setSponsorLogoBroken(true)}
                  style={{
                    width: 104.5,
                    height: 38.67,
                    objectFit: "contain",
                    // Solo invert si pedimos blanco pero no hay asset blanco real.
                    filter:
                      sponsorLogoVariant === "blanco" &&
                      !sponsor.logo_blanco_url &&
                      Boolean(sponsor.logo_color_url ?? sponsor.logo_preview_url)
                        ? "brightness(0) invert(1)"
                        : undefined,
                  }}
                />
              ) : (
                <span style={{ color: "#f3f4f6", fontSize: 12 }}>
                  {sponsor.nombre}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={eventLogoSrc}
                alt="Evento"
                onError={() => {
                  const paths = eventLogoPaths(eventoSlug);
                  const preferred =
                    eventLogoVariant === "blanco"
                      ? paths.blanco
                      : paths.contraste;
                  if (eventLogoSrc === preferred && preferred.endsWith(".png")) {
                    setEventLogoSrc(preferred.replace(/\.png$/i, ".svg"));
                    return;
                  }
                  setEventLogoSrc(eventLogoFallback(eventLogoVariant));
                }}
                style={{
                  width: 140,
                  height: 42,
                  objectFit: "contain",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "0 32px 50px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: 29.96,
                  lineHeight: 1.2,
                  color: "#f3f4f6",
                  wordBreak: "break-word",
                }}
              >
                {dato.trim() || "Dato impactante…"}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{sponsor.nombre}</h2>
            <p className="text-sm text-muted-foreground">
              {sponsor.paquete ?? "Sin tier"} ·{" "}
              {articulo?.status === "published"
                ? "Publicado"
                : articulo
                  ? "Borrador"
                  : prefill
                    ? "Desde insumos RRSS"
                    : "Sin artículo"}
            </p>
            {prefill ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Prefill desde LinkedIn/Instagram del portal. Revisa y guarda
                borrador o publica.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              {previewImageUrl ? "Cambiar imagen" : "Agregar imagen"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Logo del sponsor
              </Label>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    sponsorLogoVariant === "blanco" ? "default" : "outline"
                  }
                  onClick={() => setSponsorLogoVariant("blanco")}
                >
                  Blanco
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    sponsorLogoVariant === "color" ? "default" : "outline"
                  }
                  onClick={() => setSponsorLogoVariant("color")}
                >
                  Color
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Logo del evento
              </Label>
              <div className="mt-1 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    eventLogoVariant === "blanco" ? "default" : "outline"
                  }
                  onClick={() => setEventLogoVariant("blanco")}
                >
                  Blanco
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    eventLogoVariant === "contraste" ? "default" : "outline"
                  }
                  onClick={() => setEventLogoVariant("contraste")}
                >
                  Contraste
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="dato-impactante">Dato impactante</Label>
            <Textarea
              id="dato-impactante"
              value={dato}
              maxLength={DATO_MAX_CHARS}
              rows={3}
              className="mt-1"
              onChange={(e) => setDato(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {dato.length}/{DATO_MAX_CHARS}
            </p>
          </div>

          <div>
            <Label htmlFor="articulo-corto">Artículo corto</Label>
            <Textarea
              id="articulo-corto"
              value={copy}
              rows={6}
              className="mt-1"
              onChange={(e) => setCopy(e.target.value)}
              placeholder="Copy del onepager / panel de noticias (manual)"
            />
          </div>

          <div>
            <Label htmlFor="categoria">Categoría temática</Label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Sin categoría</option>
              {ARTICULO_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={saving}
            >
              Exportar PNG
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleSave("draft")}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button
              type="button"
              onClick={() => handleSave("published")}
              disabled={saving}
            >
              Publicar
            </Button>
          </div>
        </div>
      </div>

      {cropSrc ? (
        <CropModal
          imageSrc={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onConfirm={(blob, previewUrl, cropMeta) => {
            if (previewImageUrl?.startsWith("blob:")) {
              URL.revokeObjectURL(previewImageUrl);
            }
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
            setSourceBlob(blob);
            setPreviewImageUrl(previewUrl);
            setImageCrop(cropMeta);
          }}
        />
      ) : null}
    </div>
  );
}
