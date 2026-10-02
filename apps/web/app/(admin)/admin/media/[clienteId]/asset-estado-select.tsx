"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarEstadoAsset } from "../actions";

type AssetEstado =
  | "pendiente_insumos"
  | "insumos_recibidos"
  | "en_ejecucion"
  | "entregado"
  | "aprobado";

const ESTADOS: { value: AssetEstado; label: string }[] = [
  { value: "pendiente_insumos", label: "Pendiente insumos" },
  { value: "insumos_recibidos", label: "Insumos recibidos" },
  { value: "en_ejecucion", label: "En ejecución" },
  { value: "entregado", label: "Entregado" },
  { value: "aprobado", label: "Aprobado" },
];

export function AssetEstadoSelect({
  assetId,
  estado,
  clienteId,
}: {
  assetId: string;
  estado: AssetEstado;
  clienteId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={estado}
      disabled={pending}
      onValueChange={(value) => {
        startTransition(async () => {
          await actualizarEstadoAsset(assetId, value as AssetEstado, clienteId);
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ESTADOS.map((e) => (
          <SelectItem key={e.value} value={e.value} className="text-xs">
            {e.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
