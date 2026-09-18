"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createCompromisoSponsor,
  deleteCompromisoSponsor,
  type BeneficioActionState,
} from "../../compromisos/actions";
import { EstadoSelect } from "../../compromisos/estado-select";
import type { EstadoOption } from "../../compromisos/commitments-table";

export type BeneficioCompromisoRow = {
  id: string;
  tipo: string;
  tipo_beneficio: string | null;
  categoria_beneficio: string | null;
  estado_id: string | null;
  notion_page_id: string | null;
};

const TIPOS_PERSONALIZADOS = new Set([
  "Adicional",
  "Upgrade",
  "Tailor made",
]);

const INITIAL: BeneficioActionState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : "Agregar"}
    </Button>
  );
}

function canDeleteFromPanel(row: BeneficioCompromisoRow): boolean {
  return (
    row.tipo_beneficio !== null &&
    TIPOS_PERSONALIZADOS.has(row.tipo_beneficio) &&
    !row.notion_page_id
  );
}

function DeleteCompromisoButton({
  compromiso,
  eventoSlug,
}: {
  compromiso: BeneficioCompromisoRow;
  eventoSlug: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            Eliminar
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar beneficio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar “{compromiso.tipo}”? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteCompromisoSponsor(
                    compromiso.id,
                    eventoSlug,
                  );
                  setError(result.error);
                });
              }}
            >
              {pending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? <p className="max-w-48 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function AddBeneficioModal({
  eventoId,
  eventoSlug,
  sponsorId,
}: {
  eventoId: string;
  eventoSlug: string;
  sponsorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((key) => key + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Agregar beneficio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar beneficio</DialogTitle>
          <DialogDescription>
            Beneficio personalizado para este sponsor. No se sincroniza desde
            Notion ni se borra en el próximo sync.
          </DialogDescription>
        </DialogHeader>
        <AddBeneficioForm
          key={formKey}
          eventoId={eventoId}
          eventoSlug={eventoSlug}
          sponsorId={sponsorId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddBeneficioForm({
  eventoId,
  eventoSlug,
  sponsorId,
  onSuccess,
}: {
  eventoId: string;
  eventoSlug: string;
  sponsorId: string;
  onSuccess: () => void;
}) {
  const [state, action] = useActionState(createCompromisoSponsor, INITIAL);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="evento_slug" value={eventoSlug} />
      <input type="hidden" name="sponsor_id" value={sponsorId} />

      <div>
        <Label htmlFor="beneficio-nombre">Nombre</Label>
        <Input
          id="beneficio-nombre"
          name="nombre"
          required
          className="mt-1"
          placeholder="Ej. Logo en landing VIP"
        />
      </div>
      <div>
        <Label htmlFor="beneficio-tipo">Tipo</Label>
        <select
          id="beneficio-tipo"
          name="tipo_beneficio"
          required
          defaultValue="Adicional"
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="Adicional">Adicional</option>
          <option value="Upgrade">Upgrade</option>
          <option value="Tailor made">Tailor made</option>
        </select>
      </div>
      <div>
        <Label htmlFor="beneficio-categoria">Categoría</Label>
        <select
          id="beneficio-categoria"
          name="categoria_beneficio"
          required
          defaultValue="Durante evento"
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="Pre evento">Pre evento</option>
          <option value="Durante evento">Durante evento</option>
          <option value="Post evento">Post evento</option>
        </select>
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

function BeneficioGroup({
  title,
  description,
  rows,
  estados,
  eventoSlug,
}: {
  title: string;
  description?: string;
  rows: BeneficioCompromisoRow[];
  estados: EstadoOption[];
  eventoSlug: string;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Sin beneficios en este grupo.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Beneficio</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <div>
                    {row.tipo}
                    {row.tipo_beneficio &&
                    TIPOS_PERSONALIZADOS.has(row.tipo_beneficio) ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {row.tipo_beneficio}
                        {row.notion_page_id ? " · Notion" : " · Panel"}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{row.categoria_beneficio ?? "—"}</TableCell>
                <TableCell>
                  <EstadoSelect
                    compromisoId={row.id}
                    estadoId={row.estado_id}
                    eventoSlug={eventoSlug}
                    estados={estados}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {canDeleteFromPanel(row) ? (
                    <DeleteCompromisoButton
                      compromiso={row}
                      eventoSlug={eventoSlug}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </article>
  );
}

export function BeneficiosSection({
  compromisos,
  estados,
  eventoId,
  eventoSlug,
  sponsorId,
}: {
  compromisos: BeneficioCompromisoRow[];
  estados: EstadoOption[];
  eventoId: string;
  eventoSlug: string;
  sponsorId: string;
}) {
  const contrato = compromisos.filter(
    (row) => row.tipo_beneficio === "Contrato",
  );
  const personalizados = compromisos.filter(
    (row) =>
      row.tipo_beneficio !== null &&
      TIPOS_PERSONALIZADOS.has(row.tipo_beneficio),
  );
  const otros = compromisos.filter(
    (row) =>
      row.tipo_beneficio !== "Contrato" &&
      (row.tipo_beneficio === null ||
        !TIPOS_PERSONALIZADOS.has(row.tipo_beneficio)),
  );

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Beneficios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compromisos desde LAB Beneficios (Notion) y personalizados del
            panel.
          </p>
        </div>
        <AddBeneficioModal
          eventoId={eventoId}
          eventoSlug={eventoSlug}
          sponsorId={sponsorId}
        />
      </div>

      {compromisos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-medium">Este sponsor no tiene beneficios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Corrige el sync de LAB Beneficios o agrega uno desde el panel.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <BeneficioGroup
            title="Contrato"
            description="Beneficios base del tier. Solo se editan o eliminan desde Notion."
            rows={contrato}
            estados={estados}
            eventoSlug={eventoSlug}
          />
          <BeneficioGroup
            title="Adicional / Upgrade / Tailor made"
            description="Personalizados. Los del panel se pueden eliminar aquí; los de Notion, desde LAB Beneficios."
            rows={personalizados}
            estados={estados}
            eventoSlug={eventoSlug}
          />
          {otros.length > 0 ? (
            <BeneficioGroup
              title="Sin clasificar"
              description="Filas sin tipo_beneficio válido."
              rows={otros}
              estados={estados}
              eventoSlug={eventoSlug}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
