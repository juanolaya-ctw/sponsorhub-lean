import { existsSync, readdirSync } from "fs";
import path from "path";

const LOGO_DIRS = [
  "logos-sponsors-blanco",
  "sponsors/logos",
] as const;

export type StaticSponsorLogos = {
  /** Best default for preview (prefer color, then blanco, then any). */
  preview: string;
  blanco: string | null;
  color: string | null;
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.(png|jpe?g|webp|svg|gif)$/i, "")
    .replace(/^(logos?|logo)[-_]?/i, "")
    .replace(/[-_]?(blanco|white|color|colour)$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function publicRoot(): string {
  // next dev via pnpm --filter web → cwd = apps/web
  const candidates = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "apps", "web", "public"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return path.join(process.cwd(), "public");
}

type IndexedLogo = {
  url: string;
  key: string;
  variant: "blanco" | "color" | "unknown";
};

let cachedIndex: IndexedLogo[] | null = null;

function indexStaticLogos(): IndexedLogo[] {
  if (cachedIndex) return cachedIndex;
  const root = publicRoot();
  const entries: IndexedLogo[] = [];

  for (const dirName of LOGO_DIRS) {
    const abs = path.join(root, dirName);
    if (!existsSync(abs)) continue;
    for (const file of readdirSync(abs)) {
      if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(file)) continue;
      const lower = file.toLowerCase();
      let variant: IndexedLogo["variant"] = "unknown";
      if (/blanco|white/.test(lower)) variant = "blanco";
      else if (/color|colour/.test(lower)) variant = "color";
      // Carpeta logos-sponsors-blanco: sin sufijo → tratar como blanco.
      else if (dirName === "logos-sponsors-blanco") variant = "blanco";

      entries.push({
        url: `/${dirName}/${file}`,
        key: normalizeKey(file),
        variant,
      });
    }
  }

  cachedIndex = entries;
  return entries;
}

/** Match sponsor display name to static logo files in /public. */
export function resolveStaticSponsorLogos(
  nombre: string,
): StaticSponsorLogos | null {
  const key = normalizeKey(nombre);
  if (!key) return null;

  const all = indexStaticLogos();
  const matches = all.filter(
    (logo) =>
      logo.key === key ||
      logo.key.includes(key) ||
      key.includes(logo.key),
  );
  if (matches.length === 0) return null;

  // Prefer exact key match.
  const exact = matches.filter((m) => m.key === key);
  const pool = exact.length > 0 ? exact : matches;

  const blanco =
    pool.find((m) => m.variant === "blanco")?.url ??
    pool.find((m) => m.variant === "unknown")?.url ??
    null;
  const color =
    pool.find((m) => m.variant === "color")?.url ??
    // DataKnow tiene LOGO_DATAKNOW_COLOR aparte; si no hay color, reusa blanco.
    null;
  const preview = color ?? blanco ?? pool[0]?.url ?? null;
  if (!preview) return null;

  return { preview, blanco, color };
}
