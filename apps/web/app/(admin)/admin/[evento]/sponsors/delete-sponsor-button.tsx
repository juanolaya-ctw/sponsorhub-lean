"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteSponsor } from "./actions";

export function DeleteSponsorButton({
  sponsorId,
  sponsorNombre,
  eventoSlug,
  redirectAfterDelete = false,
}: {
  sponsorId: string;
  sponsorNombre: string;
  eventoSlug: string;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            {redirectAfterDelete ? "Eliminar sponsor" : "Eliminar"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar sponsor</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar a {sponsorNombre}? Esta acción eliminará también todos sus
              compromisos, archivos y accesos registrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteSponsor(sponsorId, eventoSlug);
                  setError(result.error);
                  if (!result.error) {
                    if (redirectAfterDelete) {
                      router.replace(`/admin/${eventoSlug}/sponsors`);
                    } else {
                      router.refresh();
                    }
                  }
                });
              }}
            >
              {pending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <p className="max-w-72 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
