"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AVANCE_OPCIONES,
  FILTROS_VACIOS,
  hayFiltros,
  INSUMO_OPCIONES,
  LOGO_OPCIONES,
  MEDIA_OPCIONES,
  PIEZA_OPCIONES,
  serializarFiltros,
  STAND_OPCIONES,
  type SponsorFiltros,
} from "@/lib/admin/sponsor-filtros";

type Opcion = { value: string; label: string };

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-white px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#42B3F3]/15 py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#0b6ea8]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar filtro ${label}`}
        className="rounded-full p-0.5 hover:bg-[#42B3F3]/25"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

function FiltroSelect({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: string | null;
  opciones: readonly Opcion[];
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className={cn(SELECT_CLASS, "font-normal text-foreground")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pills({
  label,
  opciones,
  seleccion,
  onToggle,
}: {
  label: string;
  opciones: readonly Opcion[];
  seleccion: string[];
  onToggle: (value: string) => void;
}) {
  if (opciones.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {opciones.map((o) => {
        const activo = seleccion.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={activo}
            onClick={() => onToggle(o.value)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
              activo
                ? "border-[#42B3F3] bg-[#42B3F3]/15 font-medium text-[#0b6ea8]"
                : "border-border bg-white hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function etiqueta(opciones: readonly Opcion[], value: string) {
  return opciones.find((o) => o.value === value)?.label ?? value;
}

export function SponsorsBuscador({
  filtros,
  tiers,
  total,
  visibles,
}: {
  filtros: SponsorFiltros;
  /** Paquetes presentes en el evento (incluye "Sin paquete" si aplica). */
  tiers: string[];
  total: number;
  visibles: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [texto, setTexto] = useState(filtros.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mantiene el input en sync si los filtros cambian desde afuera (limpiar, atrás).
  useEffect(() => setTexto(filtros.q), [filtros.q]);
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  function navegar(next: SponsorFiltros) {
    const qs = serializarFiltros(next).toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function cambiar(parcial: Partial<SponsorFiltros>) {
    navegar({ ...filtros, ...parcial });
  }

  function toggle(lista: string[], value: string) {
    return lista.includes(value)
      ? lista.filter((v) => v !== value)
      : [...lista, value];
  }

  const activos = hayFiltros(filtros);
  const tierOpciones = tiers.map((t) => ({ value: t, label: t }));

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-border bg-white p-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={texto}
          placeholder="Buscar por nombre, paquete, contacto o correo…"
          className="pl-8"
          onChange={(e) => {
            const value = e.target.value;
            setTexto(value);
            if (debounce.current) clearTimeout(debounce.current);
            debounce.current = setTimeout(() => cambiar({ q: value }), 300);
          }}
        />
      </div>

      <Pills
        label="Paquete"
        opciones={tierOpciones}
        seleccion={filtros.tier}
        onToggle={(v) => cambiar({ tier: toggle(filtros.tier, v) })}
      />
      <Pills
        label="Falta por subir"
        opciones={INSUMO_OPCIONES}
        seleccion={filtros.insumo}
        onToggle={(v) =>
          cambiar({
            insumo: toggle(filtros.insumo, v) as SponsorFiltros["insumo"],
          })
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <FiltroSelect
          label="Avance"
          value={filtros.avance}
          opciones={AVANCE_OPCIONES}
          onChange={(v) => cambiar({ avance: v as SponsorFiltros["avance"] })}
        />
        <FiltroSelect
          label="Logo"
          value={filtros.logo}
          opciones={LOGO_OPCIONES}
          onChange={(v) => cambiar({ logo: v as SponsorFiltros["logo"] })}
        />
        <FiltroSelect
          label="Pieza Soy Sponsor"
          value={filtros.pieza}
          opciones={PIEZA_OPCIONES}
          onChange={(v) => cambiar({ pieza: v as SponsorFiltros["pieza"] })}
        />
        <FiltroSelect
          label="Stand"
          value={filtros.stand}
          opciones={STAND_OPCIONES}
          onChange={(v) => cambiar({ stand: v as SponsorFiltros["stand"] })}
        />
        <FiltroSelect
          label="CT Media"
          value={filtros.media}
          opciones={MEDIA_OPCIONES}
          onChange={(v) => cambiar({ media: v as SponsorFiltros["media"] })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">
          {visibles === total
            ? `${total} sponsors`
            : `${visibles} de ${total} sponsors`}
        </span>
        {filtros.q.trim() ? (
          <Chip label={`“${filtros.q.trim()}”`} onRemove={() => cambiar({ q: "" })} />
        ) : null}
        {filtros.tier.map((t) => (
          <Chip
            key={t}
            label={t}
            onRemove={() => cambiar({ tier: filtros.tier.filter((x) => x !== t) })}
          />
        ))}
        {filtros.insumo.map((i) => (
          <Chip
            key={i}
            label={`Falta ${etiqueta(INSUMO_OPCIONES, i)}`}
            onRemove={() =>
              cambiar({ insumo: filtros.insumo.filter((x) => x !== i) })
            }
          />
        ))}
        {filtros.avance ? (
          <Chip
            label={etiqueta(AVANCE_OPCIONES, filtros.avance)}
            onRemove={() => cambiar({ avance: null })}
          />
        ) : null}
        {filtros.logo ? (
          <Chip
            label={etiqueta(LOGO_OPCIONES, filtros.logo)}
            onRemove={() => cambiar({ logo: null })}
          />
        ) : null}
        {filtros.pieza ? (
          <Chip
            label={etiqueta(PIEZA_OPCIONES, filtros.pieza)}
            onRemove={() => cambiar({ pieza: null })}
          />
        ) : null}
        {filtros.stand ? (
          <Chip
            label={`Stand: ${etiqueta(STAND_OPCIONES, filtros.stand)}`}
            onRemove={() => cambiar({ stand: null })}
          />
        ) : null}
        {filtros.media ? (
          <Chip
            label={etiqueta(MEDIA_OPCIONES, filtros.media)}
            onRemove={() => cambiar({ media: null })}
          />
        ) : null}
        {activos ? (
          <button
            type="button"
            onClick={() => navegar(FILTROS_VACIOS)}
            className="ml-auto text-xs text-secondary hover:underline"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
