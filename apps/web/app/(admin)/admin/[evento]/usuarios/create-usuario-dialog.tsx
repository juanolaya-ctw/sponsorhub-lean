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
import { createUsuario, type UsuarioActionState } from "./actions";
import type { SponsorOption } from "./types";

const INITIAL: UsuarioActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creando…" : "Crear usuario"}
    </Button>
  );
}

function CreateUsuarioForm({
  eventoId,
  slug,
  sponsors,
  onSuccess,
}: {
  eventoId: string;
  slug: string;
  sponsors: SponsorOption[];
  onSuccess: () => void;
}) {
  const [sponsorId, setSponsorId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, action] = useActionState(createUsuario, INITIAL);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="sponsor_id" value={sponsorId} />

      <div>
        <Label htmlFor="create-email">Email</Label>
        <Input
          id="create-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="create-password">Contraseña</Label>
        <div className="relative mt-1">
          <Input
            id="create-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
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
        <Label htmlFor="create-password-confirm">Confirmar contraseña</Label>
        <div className="relative mt-1">
          <Input
            id="create-password-confirm"
            name="password_confirm"
            type={showConfirm ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={
              showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"
            }
          >
            {showConfirm ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="create-nombre">Nombre completo</Label>
        <Input id="create-nombre" name="nombre" className="mt-1" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="create-cargo">Cargo</Label>
          <Input id="create-cargo" name="cargo" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="create-telefono">Teléfono</Label>
          <Input id="create-telefono" name="telefono" className="mt-1" />
        </div>
      </div>

      <div>
        <Label htmlFor="create-sponsor">Sponsor vinculado</Label>
        <Select
          value={sponsorId}
          onValueChange={(value) => setSponsorId(value ?? "")}
        >
          <SelectTrigger id="create-sponsor" className="mt-1 w-full">
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
        <Label htmlFor="create-notas">Notas internas</Label>
        <Textarea id="create-notas" name="notas" className="mt-1" rows={3} />
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

export function CreateUsuarioDialog({
  eventoId,
  slug,
  sponsors,
}: {
  eventoId: string;
  slug: string;
  sponsors: SponsorOption[];
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
        <Button type="button">+ Crear usuario</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            La cuenta quedará confirmada y vinculada a un sponsor del evento.
          </DialogDescription>
        </DialogHeader>

        {sponsors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Primero crea o sincroniza sponsors para este evento.
          </p>
        ) : (
          <CreateUsuarioForm
            key={formKey}
            eventoId={eventoId}
            slug={slug}
            sponsors={sponsors}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
