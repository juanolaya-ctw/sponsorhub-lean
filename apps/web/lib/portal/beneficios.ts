import type { SupabaseClient } from "@supabase/supabase-js";

export const ARCHIVOS_BUCKET = "sponsorhub-archivos";

export const TIPO_LOGO = "logo_ai";
export const TIPO_LOGO_LEGACY = "logo";
export const TIPO_NEWSLETTER = "newsletter";
export const TIPO_LINKEDIN_INSTAGRAM = "linkedin_instagram";
export const TIPO_SPEAKER_FORM = "speaker_form_completado";
export const TIPO_DECK_ADDONS = "Deck Add-ons";

export const ENTREGABLE_TIPOS = [
  "Deck Add-ons",
  "Toolkit",
  "Manual de marca",
  "Otro",
] as const;

export type EntregableTipo = (typeof ENTREGABLE_TIPOS)[number];

export type TipoFormulario =
  | "branding"
  | "accesos"
  | "newsletter"
  | "linkedin_instagram"
  | "speaker"
  | "addon"
  | "informativo";

export type NewsletterPayload = {
  titulo: string;
  cuerpo: string;
  cta: string;
};

export type LinkedInInstagramPayload = {
  dato_impactante: string;
  parrafo1: string;
  parrafo2: string;
  parrafo3: string;
};

export type ArchivoPortal = {
  id: string;
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
  compromiso_id: string | null;
  created_at: string;
};

export type AccesoPersona = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  documento_identidad: string | null;
  linkedin_url: string | null;
  rol_ecosistema: string | null;
  numero_celular: string | null;
  pais_residencia: string | null;
  empresa: string | null;
  industria: string | null;
  nivel_cargo: string | null;
  tipo: string;
  compromiso_id: string | null;
};

export type ProgresoBeneficio = {
  current: number;
  total: number;
  pct: number;
  completed: boolean;
  label: string;
  multiple: boolean;
};

export type BeneficioPortal = {
  compromisoId: string;
  beneficio: string;
  categoria: string;
  cantidad: number | null;
  detalleSolicitud: string | null;
  notas: string | null;
  estadoNombre: string | null;
  estadoColor: string | null;
  tipo: TipoFormulario;
  progreso: ProgresoBeneficio;
  archivos: ArchivoPortal[];
  personas: AccesoPersona[];
  logoCargado: boolean;
  logoCompartido: ArchivoPortal | null;
};

type CatalogoJoin = {
  beneficio: string;
  categoria: string;
  cantidad: number | null;
  detalle_solicitud: string | null;
  notas: string | null;
  orden: number | null;
};

type EstadoJoin = {
  nombre: string;
  color: string | null;
};

type CompromisoRow = {
  id: string;
  tipo: string;
  tipo_beneficio: string | null;
  categoria_beneficio: string | null;
  catalogo_beneficios: CatalogoJoin | CatalogoJoin[] | null;
  estados_compromiso: EstadoJoin | EstadoJoin[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Heurística de formulario: primero categoría del catálogo (CTW/CTF),
 * si no hay join usa el nombre del beneficio (LAB / panel).
 */
function resolverTipoFormulario(
  catalogoCategoria: string | null | undefined,
  beneficioNombre: string,
): TipoFormulario {
  if (catalogoCategoria) {
    const fromCatalogo = tipoFormulario(catalogoCategoria);
    if (fromCatalogo !== "informativo") return fromCatalogo;
  }
  return tipoFormulario(beneficioNombre);
}

export function iconoCategoria(categoria: string): string {
  const value = categoria.toLowerCase();
  if (value.includes("branding") || value.includes("logo")) return "🎨";
  if (value.includes("acceso")) return "👥";
  if (value.includes("newsletter")) return "📧";
  if (value.includes("stand")) return "🏗️";
  if (
    value.includes("speaker") ||
    value.includes("workshop") ||
    value.includes("panel")
  ) {
    return "🎤";
  }
  if (value.includes("descuento") || value.includes("add-on")) return "💰";
  return "📦";
}

export function tipoFormulario(categoria: string): TipoFormulario {
  const value = categoria.toLowerCase();
  if (value.includes("branding") || value.includes("logo")) return "branding";
  if (value.includes("acceso")) return "accesos";
  if (value.includes("newsletter")) return "newsletter";
  if (
    value.includes("speaker") ||
    value.includes("workshop") ||
    value.includes("panel")
  ) {
    return "speaker";
  }
  if (value.includes("descuento") || value.includes("add-on")) return "addon";
  if (/linkedin|instagram|contenido/i.test(categoria)) {
    return "linkedin_instagram";
  }
  return "informativo";
}

export function esInformativo(categoria: string): boolean {
  return tipoFormulario(categoria) === "informativo";
}

export function requiereAccion(tipo: TipoFormulario): boolean {
  return tipo !== "informativo" && tipo !== "addon";
}

export function isLogoTipo(tipo: string) {
  return tipo === TIPO_LOGO || tipo === TIPO_LOGO_LEGACY;
}

export function tipoAccesoFromCategoria(
  categoria: string,
): "vip" | "general" {
  return categoria.toLowerCase().includes("vip") ? "vip" : "general";
}

export function safeFilename(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function isStoredObject(path: string) {
  return !/^(?:texto|https?:|speaker_form_completado|linkedin_instagram)/i.test(
    path,
  );
}

export function isImageName(name: string) {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(name);
}

export function countWords(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function parseNewsletter(
  nombreArchivo: string,
): NewsletterPayload | null {
  try {
    const parsed = JSON.parse(nombreArchivo) as Partial<NewsletterPayload>;
    if (parsed && typeof parsed.titulo === "string") {
      return {
        titulo: parsed.titulo,
        cuerpo: typeof parsed.cuerpo === "string" ? parsed.cuerpo : "",
        cta: typeof parsed.cta === "string" ? parsed.cta : "",
      };
    }
  } catch {
    // Contenido legado que no es JSON.
  }
  return null;
}

export function newsletterCompleto(
  payload: NewsletterPayload | null,
  storagePath: string | null,
): boolean {
  if (!payload) return false;
  return (
    payload.titulo.trim().length > 0 &&
    payload.cuerpo.trim().length > 0 &&
    payload.cta.trim().length > 0 &&
    Boolean(storagePath && isStoredObject(storagePath))
  );
}

export function parseLinkedInInstagram(
  nombreArchivo: string,
): LinkedInInstagramPayload | null {
  try {
    const parsed = JSON.parse(nombreArchivo) as Partial<LinkedInInstagramPayload>;
    if (parsed && typeof parsed.dato_impactante === "string") {
      return {
        dato_impactante: parsed.dato_impactante,
        parrafo1: typeof parsed.parrafo1 === "string" ? parsed.parrafo1 : "",
        parrafo2: typeof parsed.parrafo2 === "string" ? parsed.parrafo2 : "",
        parrafo3: typeof parsed.parrafo3 === "string" ? parsed.parrafo3 : "",
      };
    }
  } catch {
    // Contenido legado que no es JSON.
  }
  return null;
}

export function linkedInInstagramCompleto(
  payload: LinkedInInstagramPayload | null,
): boolean {
  if (!payload) return false;
  return (
    payload.dato_impactante.trim().length > 0 &&
    payload.parrafo1.trim().length > 0 &&
    payload.parrafo2.trim().length > 0 &&
    countWords(payload.parrafo1) <= 80 &&
    countWords(payload.parrafo2) <= 80 &&
    countWords(payload.parrafo3) <= 80
  );
}

export function progresoBeneficio(
  tipo: TipoFormulario,
  cantidad: number | null,
  archivos: ArchivoPortal[],
  personas: AccesoPersona[],
): ProgresoBeneficio {
  if (tipo === "informativo" || tipo === "addon") {
    return {
      current: 0,
      total: 0,
      pct: 0,
      completed: false,
      label:
        tipo === "addon"
          ? "ColombiaTech comparte el deck aquí"
          : "No requiere acción",
      multiple: false,
    };
  }

  if (tipo === "accesos") {
    const current = personas.length;
    const total = cantidad && cantidad > 0 ? cantidad : 0;
    const completed = current >= 1;
    if (total > 0) {
      return {
        current,
        total,
        pct: Math.min(100, Math.round((current / total) * 100)),
        completed,
        label: `${current} de ${total} personas registradas`,
        multiple: true,
      };
    }
    return {
      current,
      total: Math.max(current, 1),
      pct: completed ? 100 : 0,
      completed,
      label:
        current === 1
          ? "1 persona registrada"
          : `${current} personas registradas`,
      multiple: true,
    };
  }

  if (tipo === "branding") {
    const completed = archivos.some(
      (item) =>
        isLogoTipo(item.tipo) && isStoredObject(item.storage_path),
    );
    return {
      current: completed ? 1 : 0,
      total: 1,
      pct: completed ? 100 : 0,
      completed,
      label: completed ? "Logo subido" : "Pendiente",
      multiple: false,
    };
  }

  if (tipo === "newsletter") {
    const row = archivos.find((item) => item.tipo === TIPO_NEWSLETTER) ?? archivos[0];
    // Formulario completo (JSON + imagen) O archivo real subido por CS
    const completed =
      newsletterCompleto(
        row ? parseNewsletter(row.nombre_archivo) : null,
        row?.storage_path ?? null,
      ) || Boolean(row && isStoredObject(row.storage_path));
    return {
      current: completed ? 1 : 0,
      total: 1,
      pct: completed ? 100 : 0,
      completed,
      label: completed ? "Contenido guardado" : "Pendiente",
      multiple: false,
    };
  }

  if (tipo === "linkedin_instagram") {
    const row =
      archivos.find((item) => item.tipo === TIPO_LINKEDIN_INSTAGRAM) ??
      archivos[0];
    const completed = linkedInInstagramCompleto(
      row ? parseLinkedInInstagram(row.nombre_archivo) : null,
    );
    return {
      current: completed ? 1 : 0,
      total: 1,
      pct: completed ? 100 : 0,
      completed,
      label: completed ? "Contenido guardado" : "Pendiente",
      multiple: false,
    };
  }

  const completed = archivos.some((item) => item.tipo === TIPO_SPEAKER_FORM);
  return {
    current: completed ? 1 : 0,
    total: 1,
    pct: completed ? 100 : 0,
    completed,
    label: completed ? "Formulario completado" : "Pendiente",
    multiple: false,
  };
}

function mapCompromiso(
  row: CompromisoRow,
  archivos: ArchivoPortal[],
  personas: AccesoPersona[],
): BeneficioPortal {
  const catalogo = one(row.catalogo_beneficios);
  const estado = one(row.estados_compromiso);
  const beneficio = catalogo?.beneficio ?? row.tipo;
  // Display: catálogo (Branding / Logo…) → LAB timing (Pre/Durante/Post) → Otros
  const categoria =
    catalogo?.categoria ?? row.categoria_beneficio ?? "Otros";
  const tipo = resolverTipoFormulario(catalogo?.categoria, beneficio);
  const cantidad = catalogo?.cantidad ?? null;
  const archivosDel = archivos.filter((item) => item.compromiso_id === row.id);
  const personasDel = personas.filter((item) => item.compromiso_id === row.id);

  return {
    compromisoId: row.id,
    beneficio,
    categoria,
    cantidad,
    detalleSolicitud: catalogo?.detalle_solicitud ?? null,
    notas: catalogo?.notas ?? null,
    estadoNombre: estado?.nombre ?? null,
    estadoColor: estado?.color ?? null,
    tipo,
    progreso: progresoBeneficio(tipo, cantidad, archivosDel, personasDel),
    archivos: archivosDel,
    personas: personasDel,
    logoCargado: false,
    logoCompartido: null,
  };
}

function attachLogosCompartidos(
  beneficios: BeneficioPortal[],
  archivos: ArchivoPortal[],
): BeneficioPortal[] {
  const logos = archivos.filter(
    (item) => isLogoTipo(item.tipo) && isStoredObject(item.storage_path),
  );
  const completedPaths = new Set(
    beneficios
      .filter((item) => item.tipo === "branding" && item.progreso.completed)
      .flatMap((item) =>
        item.archivos
          .filter((archivo) => isLogoTipo(archivo.tipo) && isStoredObject(archivo.storage_path))
          .map((archivo) => archivo.storage_path),
      ),
  );

  return beneficios.map((item) => {
    if (item.tipo !== "branding") return item;

    const shared =
      logos.find((logo) => logo.compromiso_id !== item.compromisoId) ?? null;
    const ownPaths = item.archivos
      .filter((archivo) => isLogoTipo(archivo.tipo) && isStoredObject(archivo.storage_path))
      .map((archivo) => archivo.storage_path);
    const sharesCompletedPath = ownPaths.some((path) => completedPaths.has(path));
    const logoCargado =
      item.progreso.completed ||
      sharesCompletedPath ||
      shared !== null;

    return {
      ...item,
      logoCargado,
      logoCompartido: item.progreso.completed ? null : shared,
    };
  });
}

export function resumenProgreso(beneficios: BeneficioPortal[]) {
  const accionables = beneficios.filter((item) => requiereAccion(item.tipo));
  const completados = accionables.filter((item) => item.progreso.completed).length;
  const total = accionables.length;
  return {
    completados,
    total,
    pct: total > 0 ? Math.round((completados / total) * 100) : 0,
  };
}

export async function loadPortalBeneficios(
  supabase: SupabaseClient,
  sponsorId: string,
): Promise<BeneficioPortal[]> {
  const [compromisosResult, archivosResult, personasResult] = await Promise.all([
    supabase
      .from("compromisos")
      .select(
        "id, tipo, tipo_beneficio, categoria_beneficio, catalogo_beneficios(beneficio, categoria, cantidad, detalle_solicitud, notas, orden), estados_compromiso(nombre, color)",
      )
      .eq("sponsor_id", sponsorId),
    supabase
      .from("archivos")
      .select("id, tipo, nombre_archivo, storage_path, compromiso_id, created_at")
      .eq("sponsor_id", sponsorId)
      .in("direccion", ["sponsor_sube", "admin_sube_por_sponsor"])
      .order("created_at", { ascending: false }),
    supabase
      .from("accesos_personas")
      .select(
        "id, nombre, apellido, email, documento_identidad, linkedin_url, rol_ecosistema, numero_celular, pais_residencia, empresa, industria, nivel_cargo, tipo, compromiso_id",
      )
      .eq("sponsor_id", sponsorId)
      .order("created_at", { ascending: true }),
  ]);

  if (compromisosResult.error) throw new Error(compromisosResult.error.message);
  if (archivosResult.error) throw new Error(archivosResult.error.message);
  if (personasResult.error) throw new Error(personasResult.error.message);

  const archivos = (archivosResult.data ?? []) as ArchivoPortal[];
  const personas = (personasResult.data ?? []) as AccesoPersona[];
  const mapped = attachLogosCompartidos(
    ((compromisosResult.data ?? []) as CompromisoRow[]).map((row) =>
      mapCompromiso(row, archivos, personas),
    ),
    archivos,
  );

  return mapped.sort((a, b) => a.categoria.localeCompare(b.categoria, "es"));
}

export async function loadPortalBeneficio(
  supabase: SupabaseClient,
  sponsorId: string,
  compromisoId: string,
): Promise<BeneficioPortal | null> {
  const beneficios = await loadPortalBeneficios(supabase, sponsorId);
  return beneficios.find((item) => item.compromisoId === compromisoId) ?? null;
}
