"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  emptyContacto,
  legacyWriteBlockedReason,
  type ContactoDraft,
} from "@/lib/media/empresa-contactos"

type ContactosFieldsProps = {
  contactos: ContactoDraft[]
  onChange: (next: ContactoDraft[]) => void
  allowMultiple?: boolean
  /** Email/tel/cargo por contacto (solo con tabla READY). */
  enableContactChannels?: boolean
}

export function ContactosFields({
  contactos,
  onChange,
  allowMultiple = true,
  enableContactChannels = false,
}: ContactosFieldsProps) {
  const blockReason = legacyWriteBlockedReason(contactos)

  const handleUpdate = (
    key: string,
    patch: Partial<Pick<ContactoDraft, "nombre" | "cargo" | "email" | "telefono">>,
  ) => {
    onChange(
      contactos.map((c) => (c.key === key ? { ...c, ...patch } : c)),
    )
  }

  const handleAdd = () => {
    if (!allowMultiple && contactos.length >= 1) return
    onChange([...contactos, emptyContacto()])
  }

  const handleRemove = (key: string) => {
    onChange(contactos.filter((c) => c.key !== key))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Contactos</Label>
        {allowMultiple ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            aria-label="Añadir contacto"
          >
            + Contacto
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {enableContactChannels
          ? "Varios contactos por empresa. Email y teléfono van en cada persona."
          : "Con el esquema vigente solo se puede guardar un contacto con nombre por empresa. Email y teléfono de la empresa siguen en los campos de fila (sin asignarlos a un contacto)."}
      </p>
      {blockReason ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {blockReason}
        </p>
      ) : null}
      {contactos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin contactos en UI.</p>
      ) : (
        contactos.map((contacto, index) => (
          <div
            key={contacto.key}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor={`contacto-nombre-${contacto.key}`}>Nombre</Label>
              <Input
                id={`contacto-nombre-${contacto.key}`}
                className="mt-1"
                value={contacto.nombre}
                onChange={(e) =>
                  handleUpdate(contacto.key, { nombre: e.target.value })
                }
                aria-label={`Nombre del contacto ${index + 1}`}
              />
            </div>
            <div>
              <Label htmlFor={`contacto-cargo-${contacto.key}`}>Cargo</Label>
              <Input
                id={`contacto-cargo-${contacto.key}`}
                className="mt-1"
                value={contacto.cargo}
                onChange={(e) =>
                  handleUpdate(contacto.key, { cargo: e.target.value })
                }
                disabled={!enableContactChannels}
                aria-label={`Cargo del contacto ${index + 1}`}
              />
            </div>
            {enableContactChannels ? (
              <>
                <div>
                  <Label htmlFor={`contacto-email-${contacto.key}`}>Email</Label>
                  <Input
                    id={`contacto-email-${contacto.key}`}
                    type="email"
                    className="mt-1"
                    value={contacto.email}
                    onChange={(e) =>
                      handleUpdate(contacto.key, { email: e.target.value })
                    }
                    aria-label={`Email del contacto ${index + 1}`}
                  />
                </div>
                <div>
                  <Label htmlFor={`contacto-tel-${contacto.key}`}>
                    Teléfono
                  </Label>
                  <Input
                    id={`contacto-tel-${contacto.key}`}
                    className="mt-1"
                    value={contacto.telefono}
                    onChange={(e) =>
                      handleUpdate(contacto.key, { telefono: e.target.value })
                    }
                    aria-label={`Teléfono del contacto ${index + 1}`}
                  />
                </div>
              </>
            ) : null}
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(contacto.key)}
                aria-label={`Quitar contacto ${index + 1}`}
              >
                Quitar
              </Button>
              {contacto.authUserId ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  Acceso vinculado: {contacto.authUserId.slice(0, 8)}…
                </span>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
