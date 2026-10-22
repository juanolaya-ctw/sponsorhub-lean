export const PIEZAS_BUCKET = "sponsor-piezas";
export const PIEZA_BG_SRC = "/templates/soy-sponsor-bg.webp";
export const PIEZA_WIDTH = 1080;
export const PIEZA_HEIGHT = 1350;

/** Zona del logo en el template (debajo de "SOY SPONSOR"), 800×320 centrada. */
const LOGO_ZONE = { x: 140, y: 615, w: 800, h: 320 } as const;

/** Ancho mínimo al rasterizar un SVG, para que no salga borroso al escalar. */
const SVG_RASTER_MIN_WIDTH = 1600;

export function piezaPath(sponsorId: string) {
  return `${sponsorId}/soy-sponsor.png`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = src;
  });
}

/** SVGs sin width/height salen con tamaño 0 o 150×150: fijamos el tamaño desde el viewBox. */
function sizeSvg(text: string): string {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== "svg") throw new Error("SVG inválido.");

  let w = parseFloat(svg.getAttribute("width") ?? "");
  let h = parseFloat(svg.getAttribute("height") ?? "");
  const vb = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  if ((!w || !h || /%/.test(svg.getAttribute("width") ?? "")) && vb?.length === 4) {
    w = vb[2] ?? 0;
    h = vb[3] ?? 0;
  }
  if (!w || !h) throw new Error("El SVG no tiene dimensiones.");

  const scale = Math.max(1, SVG_RASTER_MIN_WIDTH / w);
  svg.setAttribute("width", String(Math.round(w * scale)));
  svg.setAttribute("height", String(Math.round(h * scale)));
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  return new XMLSerializer().serializeToString(svg);
}

async function loadLogo(logoUrl: string): Promise<HTMLImageElement> {
  const res = await fetch(logoUrl);
  if (!res.ok) throw new Error("No se pudo descargar el logo.");
  const blob = await res.blob();
  const isSvg =
    blob.type.includes("svg") || /\.svg(\?|$)/i.test((logoUrl.split("?")[0] ?? ""));
  const source = isSvg
    ? new Blob([sizeSvg(await blob.text())], { type: "image/svg+xml" })
    : blob;
  const objectUrl = URL.createObjectURL(source);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Lado máximo de la copia usada para medir el área opaca (evita getImageData de 100+ MB). */
const PROBE_MAX = 1024;

/** Recorta el padding transparente para que el logo ocupe la zona completa. */
function opaqueBounds(img: HTMLImageElement) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const full = { sx: 0, sy: 0, sw: nw, sh: nh };
  try {
    const k = Math.min(1, PROBE_MAX / Math.max(nw, nh));
    const pw = Math.max(1, Math.round(nw * k));
    const ph = Math.max(1, Math.round(nh * k));
    const probe = document.createElement("canvas");
    probe.width = pw;
    probe.height = ph;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) return full;
    pctx.drawImage(img, 0, 0, pw, ph);
    const { data } = pctx.getImageData(0, 0, pw, ph);
    let minX = pw;
    let minY = ph;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        if ((data[(y * pw + x) * 4 + 3] ?? 0) > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return full;
    const sx = Math.max(0, Math.floor(minX / k) - 1);
    const sy = Math.max(0, Math.floor(minY / k) - 1);
    const ex = Math.min(nw, Math.ceil((maxX + 1) / k) + 1);
    const ey = Math.min(nh, Math.ceil((maxY + 1) / k) + 1);
    return { sx, sy, sw: ex - sx, sh: ey - sy };
  } catch {
    return full;
  }
}

/** Compone el template + logo del sponsor y devuelve un PNG 1080×1350. */
export async function componerPiezaSoySponsor(logoUrl: string): Promise<Blob> {
  const [bg, logo] = await Promise.all([
    loadImage(PIEZA_BG_SRC),
    loadLogo(logoUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = PIEZA_WIDTH;
  canvas.height = PIEZA_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible.");

  ctx.drawImage(bg, 0, 0, PIEZA_WIDTH, PIEZA_HEIGHT);

  const { sx, sy, sw, sh } = opaqueBounds(logo);
  const scale = Math.min(LOGO_ZONE.w / sw, LOGO_ZONE.h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    logo,
    sx,
    sy,
    sw,
    sh,
    LOGO_ZONE.x + (LOGO_ZONE.w - dw) / 2,
    LOGO_ZONE.y + (LOGO_ZONE.h - dh) / 2,
    dw,
    dh,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar el PNG."))),
      "image/png",
    ),
  );
}
