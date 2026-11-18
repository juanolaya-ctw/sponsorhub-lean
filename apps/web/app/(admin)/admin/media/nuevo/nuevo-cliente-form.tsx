"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { crearClienteMedia } from "../actions"
import { ContactosFields } from "../contactos-fields"
import { guardarContactosEmpresa } from "../contactos-actions"
import {
  MEDIA_CONTACTOS_TABLE_READY,
  emptyContacto,
  legacyWriteBlockedReason,
  planPersistEmpresaContactos,
  type ContactoDraft,
} from "@/lib/media/empresa-contactos"

type SponsorOption = { id: string; label: string }

export function NuevoClienteForm({ sponsors }: { sponsors: SponsorOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sponsorId, setSponsorId] = useState("none")
  const [empresaNombre, setEmpresaNombre] = useState("")
  const [contactos, setContactos] = useState<ContactoDraft[]>([emptyContacto()])
  const [filaEmail, setFilaEmail] = useState("")
  const [filaTelefono, setFilaTelefono] = useState("")
  const multiContactBlock = legacyWriteBlockedReason(contactos)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const plan = planPersistEmpresaContactos({
      empresaNombre,
      contactos,
      filaEmail,
      filaTelefono,
    })
    if (!plan.ok) {
      setError(plan.error)
      return
    }

    formData.set("nombre", plan.legacy.nombre)
    formData.set("empresa", plan.legacy.empresa ?? "")
    if (plan.legacy.email_contacto) {
      formData.set("email_contacto", plan.legacy.email_contacto)
    } else {
      formData.delete("email_contacto")
    }
    if (plan.legacy.telefono) formData.set("telefono", plan.legacy.telefono)
    else formData.delete("telefono")

    if (sponsorId && sponsorId !== "none") {
      formData.set("sponsor_id", sponsorId)
    } else {
      formData.delete("sponsor_id")
    }

    startTransition(async () => {
      const result = await crearClienteMedia(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      if (
        result.clienteId &&
        plan.mode === "table" &&
        MEDIA_CONTACTOS_TABLE_READY
      ) {
        const saved = await guardarContactosEmpresa(
          result.clienteId,
          empresaNombre,
          contactos,
          filaEmail,
          filaTelefono,
        )
        if (saved.error) {
          setError(saved.error)
          return
        }
      }
      router.push(`/admin/media/${result.clienteId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <div>
        <Label htmlFor="empresa">Empresa *</Label>
        <Input
          id="empresa"
          name="empresa_ui"
          required
          className="mt-1"
          value={empresaNombre}
          onChange={(e) => setEmpresaNombre(e.target.value)}
          aria-label="Nombre de empresa"
        />
      </div>

      <ContactosFields
        contactos={contactos}
        onChange={setContactos}
        enableContactChannels={MEDIA_CONTACTOS_TABLE_READY}
      />

      <div>
        <Label htmlFor="email_contacto">Email en fila empresa</Label>
        <Input
          id="email_contacto"
          type="email"
          className="mt-1"
          value={filaEmail}
          onChange={(e) => setFilaEmail(e.target.value)}
          aria-label="Email en fila empresa"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Legacy en fila empresa; no se asigna solo a un contacto.
        </p>
      </div>
      <div>
        <Label htmlFor="telefono">Teléfono en fila empresa</Label>
        <Input
          id="telefono"
          className="mt-1"
          value={filaTelefono}
          onChange={(e) => setFilaTelefono(e.target.value)}
          aria-label="Teléfono en fila empresa"
        />
      </div>
      {sponsors.length > 0 ? (
        <div>
          <Label>Sponsor vinculado (opcional)</Label>
          <Select value={sponsorId} onValueChange={setSponsorId}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Sin vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin vínculo</SelectItem>
              {sponsors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" name="notas" rows={3} className="mt-1" />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/media")}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending || Boolean(multiContactBlock)}
          aria-disabled={pending || Boolean(multiContactBlock)}
        >
          {pending ? "Creando…" : "Crear cliente"}
        </Button>
      </div>
    </form>
  )
}
