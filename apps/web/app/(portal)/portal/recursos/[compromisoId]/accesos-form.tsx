"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import {
  tipoAccesoFromCategoria,
  type AccesoPersona,
} from "@/lib/portal/beneficios";

const CAMPOS = [
  { name: "nombre", label: "Nombre completo", type: "text", required: true },
  { name: "documento_identidad", label: "Documento de identidad", type: "text", required: true },
  { name: "email", label: "Correo corporativo", type: "email", required: true },
  { name: "linkedin_url", label: "Perfil de LinkedIn", type: "url", required: true },
  { name: "rol_ecosistema", label: "Rol dentro del ecosistema", type: "text", required: true },
  { name: "numero_celular", label: "Número de celular", type: "tel", required: true },
  { name: "pais_residencia", label: "País de residencia", type: "text", required: true },
  { name: "empresa", label: "Empresa", type: "text", required: true },
  { name: "industria", label: "Industria", type: "text", required: true },
  { name: "nivel_cargo", label: "Nivel de cargo", type: "text", required: true },
] as const;

export function AccesosForm({
  sponsorId,
  compromisoId,
  categoria,
  cantidad,
  personas,
}: {
  sponsorId: string;
  compromisoId: string;
  categoria: string;
  cantidad: number | null;
  personas: AccesoPersona[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limite = cantidad && cantidad > 0 ? cantidad : null;
  const lleno = limite !== null && personas.length >= limite;

  async function addPersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (name: (typeof CAMPOS)[number]["name"]) =>
      String(form.get(name) ?? "").trim();
    for (const campo of CAMPOS) {
      if (campo.required && !get(campo.name)) {
        setError(`${campo.label} es obligatorio.`);
        return;
      }
    }

    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("accesos_personas").insert({
      sponsor_id: sponsorId,
      compromiso_id: compromisoId,
      tipo: tipoAccesoFromCategoria(categoria),
      nombre: get("nombre"),
      email: get("email"),
      documento_identidad: get("documento_identidad"),
      linkedin_url: get("linkedin_url"),
      rol_ecosistema: get("rol_ecosistema"),
      numero_celular: get("numero_celular"),
      pais_residencia: get("pais_residencia"),
      empresa: get("empresa"),
      industria: get("industria"),
      nivel_cargo: get("nivel_cargo"),
    });

    if (insertError) {
      setError(insertError.message);
      setPending(false);
      return;
    }

    setPending(false);
    setOpen(false);
    router.refresh();
  }

  async function removePersona(id: string) {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("accesos_personas")
      .delete()
      .eq("id", id)
      .eq("sponsor_id", sponsorId);
    if (deleteError) {
      setError(deleteError.message);
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Personas registradas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {limite
              ? `${personas.length} de ${limite} personas registradas`
              : `${personas.length} ${personas.length === 1 ? "persona registrada" : "personas registradas"}`}
          </p>
        </div>
        <Button
          type="button"
          disabled={lleno || pending}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Agregar persona
        </Button>
      </div>

      {personas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no has registrado personas para este beneficio.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {personas.map((persona) => (
              <TableRow key={persona.id}>
                <TableCell className="font-medium">{persona.nombre}</TableCell>
                <TableCell>{persona.email ?? "—"}</TableCell>
                <TableCell>{persona.empresa ?? "—"}</TableCell>
                <TableCell>{persona.nivel_cargo ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => void removePersona(persona.id)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar persona</DialogTitle>
            <DialogDescription>
              Completa los 10 datos que ColombiaTech necesita para acreditar a
              esta persona.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void addPersona(event)} className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((campo) => (
              <div
                key={campo.name}
                className={campo.name === "nombre" || campo.name === "email" ? "sm:col-span-2" : ""}
              >
                <Label htmlFor={campo.name}>{campo.label}</Label>
                <Input
                  id={campo.name}
                  name={campo.name}
                  type={campo.type}
                  required={campo.required}
                  className="mt-1"
                />
              </div>
            ))}
            <DialogFooter className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar persona"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
