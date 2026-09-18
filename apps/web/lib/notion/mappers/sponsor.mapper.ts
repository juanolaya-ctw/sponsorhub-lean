import { GOVTECH_SPONSOR_FIELD_ALLOWLIST } from "@/lib/notion/allowlist";
import type { NotionSponsorPage } from "@/lib/notion/fetch-sponsors";
import { unwrapNotionProperty, unwrapProperties } from "@/lib/notion/unwrap";

export type GovtechSponsorRow = {
  notion_page_id: string;
  nombre: string;
  paquete: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  contacto_cargo: string | null;
  logo_url: string | null;
};

export function mapGovtechSponsor(
  page: NotionSponsorPage,
): GovtechSponsorRow | { error: string } {
  const unwrapped = unwrapProperties(page.properties);
  const mapped: Record<string, string | null> = {};

  for (const [notionField, pgColumn] of GOVTECH_SPONSOR_FIELD_ALLOWLIST) {
    if (mapped[pgColumn]) continue;
    const value = unwrapped[notionField];
    if (value) mapped[pgColumn] = value;
  }

  const titleNombre = Object.values(page.properties)
    .map((property) => {
      if (
        property &&
        typeof property === "object" &&
        "type" in property &&
        (property as { type?: string }).type === "title"
      ) {
        return unwrapNotionProperty(property);
      }
      return null;
    })
    .find((value) => Boolean(value));

  const nombre = mapped.nombre?.trim() || titleNombre?.trim();
  if (!nombre) {
    return {
      error: `Página ${page.id} sin nombre (title Sponsor*/Sponsor/Nombre).`,
    };
  }

  if (!mapped.paquete) {
    console.warn(`[sync] Sponsor "${nombre}" (${page.id}) sin paquete/tier.`);
  }

  return {
    notion_page_id: page.id,
    nombre,
    paquete: mapped.paquete ?? null,
    contacto_nombre: mapped.contacto_nombre ?? null,
    contacto_email: mapped.contacto_email ?? null,
    contacto_telefono: mapped.contacto_telefono ?? null,
    contacto_cargo: mapped.contacto_cargo ?? null,
    logo_url: mapped.logo_url ?? null,
  };
}
