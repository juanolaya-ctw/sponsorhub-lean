import type { Area } from "react-easy-crop";
import { toBlob } from "html-to-image";
import { EXPORT_HEIGHT, EXPORT_WIDTH } from "@/lib/admin/articulos";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}

/** Convert remote/CORS-sensitive URLs to data URLs for html-to-image. */
export async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return src;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

export async function cropImageToCanvas(
  imageSrc: string,
  crop: Area,
  maxWidth = EXPORT_WIDTH,
  maxHeight = EXPORT_HEIGHT,
  quality = 0.92,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxWidth / crop.width, maxHeight / crop.height);
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("No se pudo recortar la imagen.");
  return blob;
}

export async function compressImageForUpload(
  blob: Blob,
  maxBytes = MAX_UPLOAD_BYTES,
  maxWidth = EXPORT_WIDTH,
  maxHeight = EXPORT_HEIGHT,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  let width = bitmap.width;
  let height = bitmap.height;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.92;
  let result: Blob | null = null;
  while (quality >= 0.45) {
    result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (result && result.size <= maxBytes) return result;
    quality -= 0.08;
  }
  if (!result) throw new Error("No se pudo comprimir la imagen.");
  return result;
}

export async function capturePreviewNode(
  node: HTMLElement,
  pixelRatio = 2,
): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio,
    cacheBust: true,
    preferredFontFormat: "woff2",
  });
  if (!blob) throw new Error("No se pudo capturar la vista previa.");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
