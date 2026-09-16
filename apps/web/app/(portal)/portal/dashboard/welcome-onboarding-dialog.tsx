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

export function WelcomeOnboardingDialog({
  beneficios,
}: {
  beneficios: { compromisoId: string; beneficio: string; categoria: string }[];
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  function irACompletar() {
    setOpen(false);
    const first = beneficios[0];
    router.push(first ? `/portal/recursos/${first.compromisoId}` : "/portal/recursos");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">
            Te damos la bienvenida a SponsorHub. Antes de comenzar, completa
            estos beneficios.
          </DialogTitle>
          <DialogDescription>
            Con esta información el equipo de ColombiaTech puede activar tu
            patrocinio a tiempo.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {beneficios.map((item) => (
            <li key={item.compromisoId} className="flex gap-2">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-medium">{item.beneficio}</p>
                <p className="text-muted-foreground">{item.categoria}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" onClick={irACompletar}>
            Ir a completar beneficios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
