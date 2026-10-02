"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activarMediaSponsor } from "./actions";

type Sponsor = { id: string; nombre: string };
type Plan = { id: string; nombre: string; creditosMensuales: number };

export function ActivarMediaDialog({
  sponsors,
  planes,
  slug,
}: {
  sponsors: Sponsor[];
  planes: Plan[];
  slug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sponsorId, setSponsorId] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setSponsorId("");
      setPlanId("");
      setError(null);
    }
  }, []);

  function handleSubmit() {
    if (!sponsorId || !planId) {
      setError("Selecciona sponsor y plan.");
      return;
    }
    startTransition(async () => {
      const result = await activarMediaSponsor(sponsorId, planId, slug);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" disabled={sponsors.length === 0}>
          + Activar Media
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activar Media</DialogTitle>
          <DialogDescription>
            Asigna un plan de créditos mensuales a un sponsor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Sponsor</Label>
            <Select value={sponsorId} onValueChange={setSponsorId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Seleccionar sponsor" />
              </SelectTrigger>
              <SelectContent>
                {sponsors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.creditosMensuales.toLocaleString()} cr.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Activando…" : "Activar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
