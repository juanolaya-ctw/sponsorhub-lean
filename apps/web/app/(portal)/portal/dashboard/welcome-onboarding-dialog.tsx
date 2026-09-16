"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WelcomeOnboardingDialog() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden bg-white sm:max-w-md"
      >
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration-login.png"
            alt=""
            aria-hidden
            className="h-[200px] w-auto object-contain"
          />
          <DialogHeader className="mt-4 items-center">
            <DialogTitle className="text-xl font-semibold leading-snug">
              Bienvenido a SponsorHub
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              Aquí puedes hacer seguimiento en tiempo real al estado de cada uno
              de tus beneficios como sponsor de ColombiaTech, subir los recursos
              que necesitamos para activarlos y descargar los entregables que el
              equipo preparó para ti.
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="mt-6 w-full bg-[#040402] text-white hover:bg-[#040402]/90"
            onClick={() => setOpen(false)}
          >
            Empezar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
