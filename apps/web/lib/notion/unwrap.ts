type NotionRichText = { plain_text?: string };

function richText(items: NotionRichText[] | undefined): string | null {
  if (!items?.length) return null;
  const text = items
    .map((item) => item.plain_text ?? "")
    .join("")
    .trim();
  return text || null;
}

function fileUrl(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) return null;
  const first = files[0] as {
    type?: string;
    file?: { url?: string };
    external?: { url?: string };
  };
  const url = first.file?.url ?? first.external?.url ?? null;
  return url?.trim() || null;
}

/**
 * Extrae un string plano de una property de Notion.
 * No devolver el objeto crudo: Postgres espera text.
 */
export function unwrapNotionProperty(property: unknown): string | null {
  if (property == null || typeof property !== "object") return null;
  const value = property as Record<string, unknown> & { type?: string };

  switch (value.type) {
    case "title":
      return richText(value.title as NotionRichText[]);
    case "rich_text":
      return richText(value.rich_text as NotionRichText[]);
    case "select": {
      const select = value.select as { name?: string } | null;
      return select?.name?.trim() || null;
    }
    case "status": {
      const status = value.status as { name?: string } | null;
      return status?.name?.trim() || null;
    }
    case "email": {
      const email = typeof value.email === "string" ? value.email.trim() : "";
      return email || null;
    }
    case "phone_number": {
      const phone =
        typeof value.phone_number === "string" ? value.phone_number.trim() : "";
      return phone || null;
    }
    case "url": {
      const url = typeof value.url === "string" ? value.url.trim() : "";
      return url || null;
    }
    case "files":
      return fileUrl(value.files);
    case "multi_select": {
      const names = (value.multi_select as Array<{ name?: string }> | undefined)
        ?.map((item) => item.name?.trim())
        .filter(Boolean);
      return names?.length ? names.join(", ") : null;
    }
    case "number":
      return value.number == null ? null : String(value.number);
    case "formula": {
      const formula = value.formula as {
        type?: string;
        string?: string | null;
        number?: number | null;
        boolean?: boolean | null;
      } | null;
      if (!formula) return null;
      if (formula.type === "string") return formula.string?.trim() || null;
      if (formula.type === "number") {
        return formula.number == null ? null : String(formula.number);
      }
      if (formula.type === "boolean") {
        return formula.boolean == null ? null : String(formula.boolean);
      }
      return null;
    }
    case "rollup": {
      const rollup = value.rollup as {
        type?: string;
        array?: unknown[];
        string?: string | null;
      } | null;
      if (rollup?.type === "array" && rollup.array?.[0]) {
        return unwrapNotionProperty(rollup.array[0]);
      }
      return rollup?.string?.trim() || null;
    }
    default:
      return null;
  }
}

export function getProperty(
  properties: Record<string, unknown>,
  name: string,
): unknown {
  if (name in properties) return properties[name];
  const target = name.trim().toLowerCase();
  for (const [key, property] of Object.entries(properties)) {
    if (key.trim().toLowerCase() === target) return property;
  }
  return undefined;
}

export function unwrapProperties(
  properties: Record<string, unknown>,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const [key, property] of Object.entries(properties)) {
    result[key] = unwrapNotionProperty(property);
  }
  return result;
}
