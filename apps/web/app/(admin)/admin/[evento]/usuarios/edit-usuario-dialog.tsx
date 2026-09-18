"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateUsuario, type UsuarioActionState } from "./actions";
import type { SponsorOption, UsuarioRow } from "./types";

const INITIAL: UsuarioActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Guardar cambios"}
    </Button>
  );
}

function EditUsuarioForm({
  usuario,
  sponsors,
  eventoId,
  slug,
  onSuccess,
}: {
  usuario: UsuarioRow;
  sponsors: SponsorOption[];
  eventoId: string;
  slug: string;
  onSuccess: () => void;
}) {
  const [sponsorId, setSponsorId] = useState(usuario.sponsorId);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action] = useActionState(updateUsuario, INITIAL);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="user_id" value={usuario.id} />
      <input type="hidden" name="sponsor_id" value={sponsorId} />

      <div>
        <Label htmlFor={`edit-email-${usuario.id}`}>Email</Label>
        <Input
          id={`edit-email-${usuario.id}`}
          name="email"
          type="email"
          defaultValue={usuario.email ?? ""}
          autoComplete="off"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor={`edit-password-${usuario.id}`}>Nueva contraseña</Label>
        <div className="relative mt-1">
          <Input
            id={`edit-password-${usuario.id}`}
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            autoComplete="new-password"
            placeholder="Dejar vacío para no cambiar"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor={`edit-nombre-${usuario.id}`}>Nombre completo</Label>
        <Input
          id={`edit-nombre-${usuario.id}`}
          name="nombre"
          defaultValue={usuario.nombre ?? ""}
          className="mt-1"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`edit-cargo-${usuario.id}`}>Cargo</Label>
          <Input
            id={`edit-cargo-${usuario.id}`}
            name="cargo"
            defaultValue={usuario.cargo ?? ""}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`edit-telefono-${usuario.id}`}>Teléfono</Label>
          <Input
            id={`edit-telefono-${usuario.id}`}
            name="telefono"
            defaultValue={usuario.telefono ?? ""}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`edit-sponsor-${usuario.id}`}>Sponsor vinculado</Label>
        <Select value={sponsorId} onValueChange={setSponsorId}>
          <SelectTrigger
            id={`edit-sponsor-${usuario.id}`}
            className="mt-1 w-full"
          >
            <SelectValue placeholder="Seleccionar sponsor" />
          </SelectTrigger>
          <SelectContent>
            {sponsors.map((sponsor) => (
              <SelectItem key={sponsor.id} value={sponsor.id}>
                {sponsor.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor={`edit-notas-${usuario.id}`}>Notas internas</Label>
        <Textarea
          id={`edit-notas-${usuario.id}`}
          name="notas"
          defaultValue={usuario.notas ?? ""}
          className="mt-1"
          rows={3}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <DialogFooter>
        <SubmitButton />
      </DialogFooter>
    </form>
  );
}

export function EditUsuarioDialog({
  usuario,
  sponsors,
  eventoId,
  slug,
}: {
  usuario: UsuarioRow;
  sponsors: SponsorOption[];
  eventoId: string;
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const handleSuccess = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Actualiza el perfil o restablece email y contraseña. El rol no se
            cambia desde aquí.
          </DialogDescription>
        </DialogHeader>

        <EditUsuarioForm
          key={formKey}
          usuario={usuario}
          sponsors={sponsors}
          eventoId={eventoId}
          slug={slug}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
