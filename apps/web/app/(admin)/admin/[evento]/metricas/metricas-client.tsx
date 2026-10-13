"use client";

import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadBlob } from "@/lib/admin/articulos-image";
import { cn } from "@/lib/utils";

export type AccesoMetricasRow = {
  id: string;
  sponsor_id: string;
  sponsor_nombre: string;
  sponsor_paquete: string | null;
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
  cargo: string | null;
  tipo: string;
  created_at: string;
};

type TabId = "resumen" | "accesos";

function nombreCompleto(row: AccesoMetricasRow): string {
  return [row.nombre, row.apellido].filter(Boolean).join(" ") || "—";
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildAccesosCsv(rows: AccesoMetricasRow[]): string {
  const headers = [
    "Sponsor",
    "Tier / paquete",
    "Tipo acceso",
    "Nombre completo",
    "Documento",
    "Email",
    "LinkedIn",
    "Rol ecosistema",
    "Celular",
    "País",
    "Empresa",
    "Industria",
    "Nivel de cargo",
    "Registrado el",
  ];

  const lines = rows.map((row) =>
    [
      row.sponsor_nombre,
      row.sponsor_paquete ?? "",
      row.tipo,
      nombreCompleto(row) === "—" ? "" : nombreCompleto(row),
      row.documento_identidad ?? "",
      row.email ?? "",
      row.linkedin_url ?? "",
      row.rol_ecosistema ?? "",
      row.numero_celular ?? "",
      row.pais_residencia ?? "",
      row.empresa ?? "",
      row.industria ?? "",
      row.nivel_cargo ?? row.cargo ?? "",
      row.created_at,
    ]
      .map((cell) => csvEscape(String(cell)))
      .join(","),
  );

  return `\uFEFF${[headers.join(","), ...lines].join("\n")}`;
}

function AccesosTab({
  accesos,
  eventoNombre,
}: {
  accesos: AccesoMetricasRow[];
  eventoNombre: string;
}) {
  function exportCsv() {
    const csv = buildAccesosCsv(accesos);
    const slug = eventoNombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `accesos-${slug || "evento"}.csv`,
    );
  }

  if (accesos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
        <p className="font-medium">Aún no hay accesos registrados</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando los sponsors registren personas, aparecerán aquí para exportar
          a CS.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {accesos.length}{" "}
          {accesos.length === 1 ? "persona registrada" : "personas registradas"}{" "}
          · listo para crear credenciales
        </p>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sponsor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nombre completo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>País</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accesos.map((persona) => (
              <TableRow key={persona.id}>
                <TableCell className="font-medium">
                  {persona.sponsor_nombre}
                </TableCell>
                <TableCell className="capitalize">{persona.tipo}</TableCell>
                <TableCell>{nombreCompleto(persona)}</TableCell>
                <TableCell>{persona.documento_identidad ?? "—"}</TableCell>
                <TableCell>{persona.email ?? "—"}</TableCell>
                <TableCell>{persona.numero_celular ?? "—"}</TableCell>
                <TableCell>{persona.empresa ?? "—"}</TableCell>
                <TableCell>
                  {persona.nivel_cargo ?? persona.cargo ?? "—"}
                </TableCell>
                <TableCell>{persona.pais_residencia ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function MetricasClient({
  resumen,
  accesos,
  eventoNombre,
  accesosCount,
}: {
  resumen: ReactNode;
  accesos: AccesoMetricasRow[];
  eventoNombre: string;
  accesosCount: number;
}) {
  const [tab, setTab] = useState<TabId>("resumen");

  const tabs: { id: TabId; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "accesos", label: `Accesos (${accesosCount})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div key={tab}>
        {tab === "resumen" ? (
          resumen
        ) : (
          <AccesosTab accesos={accesos} eventoNombre={eventoNombre} />
        )}
      </div>
    </div>
  );
}
