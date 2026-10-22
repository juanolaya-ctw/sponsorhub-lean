/** Filtros del buscador de Sponsors (admin). Puro: lo usan servidor y cliente. */

export const AVANCE_OPCIONES = [
  { value: "sin_avance", label: "Sin avance (0%)" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completo", label: "Completo (100%)" },
  { value: "sin_beneficios", label: "Sin beneficios con acción" },
] as const;

export const LOGO_OPCIONES = [
  { value: "sin_logo", label: "Sin logo" },
  { value: "necesita_png", label: "Solo .ai/.eps (falta PNG o SVG)" },
  { value: "usable", label: "Con PNG/SVG" },
] as const;

export const PIEZA_OPCIONES = [
  { value: "generada", label: "Pieza generada" },
  { value: "pendiente", label: "Pieza pendiente" },
] as const;

export const INSUMO_OPCIONES = [
  { value: "branding", label: "Logo" },
  { value: "newsletter", label: "Newsletter" },
  { value: "linkedin_instagram", label: "LinkedIn / Instagram" },
  { value: "speaker", label: "Speaker / Panel" },
  { value: "stand", label: "Stand" },
  { value: "accesos", label: "Accesos" },
] as const;

export const STAND_OPCIONES = [
  { value: "sin_stand", label: "Sin stand" },
  { value: "sin_render", label: "Esperando render" },
  { value: "pendiente_aprobacion", label: "Pendiente de aprobación" },
  { value: "cambios_solicitados", label: "Cambios solicitados" },
  { value: "aprobado", label: "Aprobado" },
] as const;

export const MEDIA_OPCIONES = [
  { value: "si", label: "Con CT Media" },
  { value: "no", label: "Sin CT Media" },
] as const;

export type AvanceValor = (typeof AVANCE_OPCIONES)[number]["value"];
export type LogoValor = (typeof LOGO_OPCIONES)[number]["value"];
export type PiezaValor = (typeof PIEZA_OPCIONES)[number]["value"];
export type InsumoValor = (typeof INSUMO_OPCIONES)[number]["value"];
export type StandValor = (typeof STAND_OPCIONES)[number]["value"];
export type MediaValor = (typeof MEDIA_OPCIONES)[number]["value"];

/** Datos derivados de cada sponsor que usan los filtros. */
export type SponsorFiltrable = {
  id: string;
  nombre: string;
  paquete: string | null;
  contactoNombre: string | null;
  contactoEmail: string | null;
  ctMedia: boolean;
  avancePct: number;
  avance: AvanceValor;
  logo: LogoValor;
  pieza: PiezaValor;
  insumosPendientes: InsumoValor[];
  stand: StandValor;
};

export type SponsorFiltros = {
  q: string;
  tier: string[];
  avance: AvanceValor | null;
  logo: LogoValor | null;
  pieza: PiezaValor | null;
  insumo: InsumoValor[];
  stand: StandValor | null;
  media: MediaValor | null;
};

export const FILTROS_VACIOS: SponsorFiltros = {
  q: "",
  tier: [],
  avance: null,
  logo: null,
  pieza: null,
  insumo: [],
  stand: null,
  media: null,
};

export function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function csv(value: string | string[] | undefined): string[] {
  return first(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function enumOrNull<T extends string>(
  value: string,
  opciones: readonly { value: T }[],
): T | null {
  return opciones.find((o) => o.value === value)?.value ?? null;
}

export function parseFiltros(params: SearchParamsLike): SponsorFiltros {
  const insumoValidos = new Set<string>(INSUMO_OPCIONES.map((o) => o.value));
  return {
    q: first(params.q).slice(0, 100),
    tier: csv(params.tier),
    avance: enumOrNull(first(params.avance), AVANCE_OPCIONES),
    logo: enumOrNull(first(params.logo), LOGO_OPCIONES),
    pieza: enumOrNull(first(params.pieza), PIEZA_OPCIONES),
    insumo: csv(params.insumo).filter((v): v is InsumoValor =>
      insumoValidos.has(v),
    ),
    stand: enumOrNull(first(params.stand), STAND_OPCIONES),
    media: enumOrNull(first(params.media), MEDIA_OPCIONES),
  };
}

export function serializarFiltros(filtros: SponsorFiltros): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.q.trim()) params.set("q", filtros.q.trim());
  if (filtros.tier.length) params.set("tier", filtros.tier.join(","));
  if (filtros.avance) params.set("avance", filtros.avance);
  if (filtros.logo) params.set("logo", filtros.logo);
  if (filtros.pieza) params.set("pieza", filtros.pieza);
  if (filtros.insumo.length) params.set("insumo", filtros.insumo.join(","));
  if (filtros.stand) params.set("stand", filtros.stand);
  if (filtros.media) params.set("media", filtros.media);
  return params;
}

export function hayFiltros(filtros: SponsorFiltros): boolean {
  return serializarFiltros(filtros).size > 0;
}

export function aplicarFiltros(
  sponsors: SponsorFiltrable[],
  filtros: SponsorFiltros,
): SponsorFiltrable[] {
  const tokens = normalizarTexto(filtros.q).split(/\s+/).filter(Boolean);
  const tiers = new Set(filtros.tier.map(normalizarTexto));

  return sponsors.filter((s) => {
    if (tokens.length > 0) {
      const haystack = normalizarTexto(
        [s.nombre, s.paquete, s.contactoNombre, s.contactoEmail]
          .filter(Boolean)
          .join(" "),
      );
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    if (tiers.size > 0 && !tiers.has(normalizarTexto(s.paquete ?? "sin paquete"))) {
      return false;
    }
    if (filtros.avance && s.avance !== filtros.avance) return false;
    if (filtros.logo && s.logo !== filtros.logo) return false;
    if (filtros.pieza && s.pieza !== filtros.pieza) return false;
    // Varios insumos: el sponsor debe tener pendientes TODOS los elegidos.
    if (
      filtros.insumo.length > 0 &&
      !filtros.insumo.every((i) => s.insumosPendientes.includes(i))
    ) {
      return false;
    }
    if (filtros.stand && s.stand !== filtros.stand) return false;
    if (filtros.media === "si" && !s.ctMedia) return false;
    if (filtros.media === "no" && s.ctMedia) return false;
    return true;
  });
}
