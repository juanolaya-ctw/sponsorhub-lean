import {
  isImageName,
  isLogoTipo,
  isStoredObject,
  requiereAccion,
  resumenProgreso,
  type BeneficioPortal,
} from "@/lib/portal/beneficios";
import type {
  AvanceValor,
  InsumoValor,
  LogoValor,
  PiezaValor,
  StandValor,
} from "./sponsor-filtros";

const INSUMOS_FILTRABLES: readonly InsumoValor[] = [
  "branding",
  "newsletter",
  "linkedin_instagram",
  "speaker",
  "stand",
  "accesos",
];

export type ArchivoLogoRow = {
  sponsor_id: string;
  tipo: string;
  nombre_archivo: string;
  storage_path: string;
};

export function derivarAvance(beneficios: BeneficioPortal[]): {
  pct: number;
  avance: AvanceValor;
} {
  const { pct, total, completados } = resumenProgreso(beneficios);
  if (total === 0) return { pct: 0, avance: "sin_beneficios" };
  if (completados === total) return { pct: 100, avance: "completo" };
  if (completados === 0 && pct === 0) return { pct: 0, avance: "sin_avance" };
  return { pct, avance: "en_progreso" };
}

export function derivarInsumosPendientes(
  beneficios: BeneficioPortal[],
): InsumoValor[] {
  const pendientes = new Set<InsumoValor>();
  for (const item of beneficios) {
    if (!requiereAccion(item.tipo) || item.progreso.completed) continue;
    // Logo ya cargado en otro beneficio cuenta como cubierto.
    if (item.tipo === "branding" && item.logoCargado) continue;
    if ((INSUMOS_FILTRABLES as readonly string[]).includes(item.tipo)) {
      pendientes.add(item.tipo as InsumoValor);
    }
  }
  return [...pendientes];
}

export function derivarStand(beneficios: BeneficioPortal[]): StandValor {
  const stand = beneficios.find((item) => item.tipo === "stand");
  if (!stand) return "sin_stand";
  if (stand.standRevision?.decision === "aprobado") return "aprobado";
  if (stand.standRevision?.decision === "cambios_solicitados") {
    return "cambios_solicitados";
  }
  return stand.progreso.label === "Esperando render"
    ? "sin_render"
    : "pendiente_aprobacion";
}

export function derivarLogo(archivos: ArchivoLogoRow[]): LogoValor {
  const logos = archivos.filter(
    (a) => isLogoTipo(a.tipo) && isStoredObject(a.storage_path),
  );
  if (logos.length === 0) return "sin_logo";
  return logos.some((a) => isImageName(a.nombre_archivo))
    ? "usable"
    : "necesita_png";
}

export function derivarPieza(piezaPath: string | null): PiezaValor {
  return piezaPath ? "generada" : "pendiente";
}
