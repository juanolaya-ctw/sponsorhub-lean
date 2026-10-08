"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { EXPORT_HEIGHT, EXPORT_WIDTH } from "@/lib/admin/articulos";
import { cropImageToCanvas } from "@/lib/admin/articulos-image";

const ASPECT = EXPORT_WIDTH / EXPORT_HEIGHT;

export function CropModal({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob, previewUrl: string, cropMeta: { x: number; y: number; zoom: number }) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function confirm() {
    if (!croppedArea) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropImageToCanvas(imageSrc, croppedArea);
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(blob, previewUrl, {
        x: croppedArea.x,
        y: croppedArea.y,
        zoom,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al recortar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-white p-4 shadow-lg">
        <h3 className="font-semibold">Recortar imagen</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Relación 4:5 ({EXPORT_WIDTH}×{EXPORT_HEIGHT})
        </p>
        <div className="relative mt-4 h-[340px] overflow-hidden rounded-lg bg-[#1f2937]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <span className="w-12 text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={busy || !croppedArea}>
            {busy ? "Recortando…" : "Usar recorte"}
          </Button>
        </div>
      </div>
    </div>
  );
}
