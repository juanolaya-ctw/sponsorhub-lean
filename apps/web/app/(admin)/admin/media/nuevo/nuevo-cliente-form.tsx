"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearClienteMedia } from "../actions";

type SponsorOption = { id: string; label: string };

export function NuevoClienteForm({ sponsors }: { sponsors: SponsorOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sponsorId, setSponsorId] = useState("none");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (sponsorId && sponsorId !== "none") {
      formData.set("sponsor_id", sponsorId);
    } else {
      formData.delete("sponsor_id");
    }
    startTransition(async () => {
      const result = await crearClienteMedia(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/admin/media/${result.clienteId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <Label htmlFor="nombre">Nombre *</Label>
        <Input id="nombre" name="nombre" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="empresa">Empresa</Label>
        <Input id="empresa" name="empresa" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="email_contacto">Email de contacto</Label>
        <Input id="email_contacto" name="email_contacto" type="email" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" className="mt-1" />
      </div>
      {sponsors.length > 0 ? (
        <div>
          <Label>Sponsor vinculado (opcional)</Label>
          <Select value={sponsorId} onValueChange={setSponsorId}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Sin vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin vínculo</SelectItem>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={3} className="mt-1" />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/media")}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
