"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FORMATO_MAX,
  INSTRUCCIONES_MAX,
} from "@/lib/media/portal-cliente";

export type InstruccionesInsumosValue = {
  instrucciones: string;
  formato: string;
  fechaLimite: string;
};

export const EMPTY_INSTRUCCIONES: InstruccionesInsumosValue = {
  instrucciones: "",
  formato: "",
  fechaLimite: "",
};

export function InstruccionesInsumosFields({
  value,
  onChange,
  idPrefix,
}: {
  value: InstruccionesInsumosValue;
  onChange: (next: InstruccionesInsumosValue) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-instrucciones`}>
          ¿Qué debe subir el cliente?
        </Label>
        <Textarea
          id={`${idPrefix}-instrucciones`}
          value={value.instrucciones}
          onChange={(e) =>
            onChange({ ...value, instrucciones: e.target.value })
          }
          className="mt-1"
          rows={4}
          maxLength={INSTRUCCIONES_MAX}
          placeholder="Ej.: Logo en alta resolución, 3 fotos del producto y un texto de 80 palabras con el mensaje clave."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-formato`}>Formato aceptado</Label>
          <Input
            id={`${idPrefix}-formato`}
            value={value.formato}
            onChange={(e) => onChange({ ...value, formato: e.target.value })}
            className="mt-1"
            maxLength={FORMATO_MAX}
            placeholder="Ej.: PDF, PNG o JPG"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-fecha`}>Fecha límite</Label>
          <Input
            id={`${idPrefix}-fecha`}
            type="date"
            value={value.fechaLimite}
            onChange={(e) =>
              onChange({ ...value, fechaLimite: e.target.value })
            }
            className="mt-1"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        El cliente ve esto en la pieza, justo encima del botón para subir
        archivos. Todo es opcional.
      </p>
    </div>
  );
}
