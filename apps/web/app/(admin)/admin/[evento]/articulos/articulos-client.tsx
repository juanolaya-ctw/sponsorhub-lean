"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  cardStatus,
  type ArticuloSponsorCard,
} from "@/lib/admin/articulos";
import { ArticuloEditor } from "./articulo-editor";

const TIER_COLORS: Record<string, string> = {
  diamond: "bg-sky-100 text-sky-800",
  platinum: "bg-slate-200 text-slate-800",
  gold: "bg-amber-100 text-amber-900",
  silver: "bg-zinc-100 text-zinc-700",
  bronze: "bg-orange-100 text-orange-900",
};

function statusLabel(
  status: ReturnType<typeof cardStatus>,
  hasInsumo: boolean,
) {
  if (status === "published") return "Publicado";
  if (status === "draft") return "Borrador";
  if (hasInsumo) return "Insumo RRSS";
  return "Sin artículo";
}

function statusClass(status: ReturnType<typeof cardStatus>) {
  if (status === "published") return "bg-emerald-100 text-emerald-800";
  if (status === "draft") return "bg-amber-100 text-amber-900";
  return "bg-muted text-muted-foreground";
}

export function ArticulosClient({
  eventoId,
  eventoSlug,
  initialSponsors,
}: {
  eventoId: string;
  eventoSlug: string;
  initialSponsors: ArticuloSponsorCard[];
}) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [articleFilter, setArticleFilter] = useState<
    "all" | "sin" | "draft" | "published"
  >("all");
  const [logoFilter, setLogoFilter] = useState<"all" | "yes" | "no">("all");

  const tiers = useMemo(() => {
    const set = new Set<string>();
    for (const s of sponsors) {
      if (s.paquete) set.add(s.paquete);
    }
    return Array.from(set).sort();
  }, [sponsors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sponsors.filter((s) => {
      if (q && !s.nombre.toLowerCase().includes(q)) return false;
      if (tierFilter !== "all" && (s.paquete ?? "") !== tierFilter) return false;
      const st = cardStatus(s.articulo);
      if (articleFilter !== "all" && st !== articleFilter) return false;
      if (logoFilter === "yes" && !s.has_logo_blanco && !s.logo_url) return false;
      if (logoFilter === "no" && (s.has_logo_blanco || s.logo_url)) return false;
      return true;
    });
  }, [sponsors, query, tierFilter, articleFilter, logoFilter]);

  const selected = selectedId
    ? (sponsors.find((s) => s.id === selectedId) ?? null)
    : null;

  if (selected) {
    return (
      <ArticuloEditor
        eventoId={eventoId}
        eventoSlug={eventoSlug}
        sponsor={selected}
        onBack={() => setSelectedId(null)}
        onSaved={(card) => {
          setSponsors((prev) =>
            prev.map((s) => (s.id === card.id ? card : s)),
          );
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Artículos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            HITL: dato impactante, plantilla 4:5 y publicación
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} de {sponsors.length} sponsors
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sponsor…"
            className="pl-9"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="flex h-9 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="all">Todos los tiers</option>
          {tiers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={articleFilter}
          onChange={(e) =>
            setArticleFilter(
              e.target.value as "all" | "sin" | "draft" | "published",
            )
          }
          className="flex h-9 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="all">Artículo: todos</option>
          <option value="sin">Sin artículo</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
        </select>
        <select
          value={logoFilter}
          onChange={(e) => setLogoFilter(e.target.value as "all" | "yes" | "no")}
          className="flex h-9 rounded-lg border border-border bg-background px-3 text-sm sm:col-span-2 lg:col-span-1"
        >
          <option value="all">Logo: todos</option>
          <option value="yes">Con logo</option>
          <option value="no">Sin logo</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <p className="font-medium">No hay sponsors con estos filtros</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const st = cardStatus(s.articulo);
            const hasInsumo = Boolean(s.insumo_prefill);
            const tierKey = (s.paquete ?? "").toLowerCase();
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="rounded-xl border border-border bg-white p-4 text-left transition-colors hover:border-foreground/20 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.nombre}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.paquete ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            TIER_COLORS[tierKey] ?? "bg-muted text-foreground"
                          }`}
                        >
                          {s.paquete}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          st === "sin" && hasInsumo
                            ? "bg-sky-100 text-sky-800"
                            : statusClass(st)
                        }`}
                      >
                        {statusLabel(st, hasInsumo)}
                      </span>
                    </div>
                  </div>
                  {s.logo_preview_url ||
                  s.logo_color_url ||
                  s.logo_blanco_url ||
                  s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        s.logo_preview_url ??
                        s.logo_color_url ??
                        s.logo_blanco_url ??
                        s.logo_url ??
                        ""
                      }
                      alt=""
                      className="size-10 shrink-0 rounded bg-[#131212] object-contain p-1"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
                {s.articulo?.dato_impactante ||
                s.insumo_prefill?.dato_impactante ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {s.articulo?.dato_impactante ||
                      s.insumo_prefill?.dato_impactante}
                  </p>
                ) : null}
                {!s.articulo && s.insumo_prefill ? (
                  <p className="mt-2 text-xs font-medium text-sky-700">
                    Insumo RRSS listo para editar
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
