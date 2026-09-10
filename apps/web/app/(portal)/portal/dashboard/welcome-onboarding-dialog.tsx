"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { InsumoRequerido } from "@/lib/portal/insumos";

export function WelcomeOnboardingDialog({
  insumos,
}: {
  insumos: InsumoRequerido[];
}) {
  // Se monta solo cuando el sponsor no tiene archivos subidos, así que se
  // abre de una vez. Cuando sube al menos un archivo el servidor deja de
  // renderizar este componente y el modal no vuelve a aparecer.
  const [open, setOpen] = useState(true);
  const router = useRouter();

  function irASubir() {
    setOpen(false);
    router.push("/portal/recursos");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">
            Te damos la bienvenida a SponsorHub. Antes de comenzar, necesitamos
            que subas estos recursos.
          </DialogTitle>
          <DialogDescription>
            Con estos insumos el equipo de ColombiaTech puede activar tu
            patrocinio a tiempo.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {insumos.map((insumo) => (
            <li key={insumo.key} className="flex gap-2">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-medium">{insumo.nombre}</p>
                <p className="text-muted-foreground">{insumo.descripcion}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" onClick={irASubir}>
            Ir a subir recursos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
