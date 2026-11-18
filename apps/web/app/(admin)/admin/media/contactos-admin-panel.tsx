"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ContactosFields } from "./contactos-fields"
import {
  crearAccesoMediaContacto,
  desvincularAccesoContacto,
  generarEnlaceAccesoMediaContacto,
  guardarContactosEmpresa,
  vincularAccesoMediaContacto,
} from "./contactos-actions"
import {
  MEDIA_CONTACTOS_TABLE_READY,
  emptyContacto,
  type ContactoDraft,
} from "@/lib/media/empresa-contactos"

type ContactosAdminPanelProps = {
  clienteId: string
  empresaNombre: string
  filaEmail: string | null
  filaTelefono: string | null
  initialContactos: ContactoDraft[]
}

export function ContactosAdminPanel({
  clienteId,
  empresaNombre,
  filaEmail,
  filaTelefono,
  initialContactos,
}: ContactosAdminPanelProps) {
  const [contactos, setContactos] = useState<ContactoDraft[]>(
    initialContactos.length > 0 ? initialContactos : [emptyContacto()],
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [linkContactoId, setLinkContactoId] = useState(
    initialContactos.find((c) => c.id)?.id ?? "",
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [accessLink, setAccessLink] = useState<string | null>(null)
  const [accessLinkHint, setAccessLinkHint] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await guardarContactosEmpresa(
        clienteId,
        empresaNombre,
        contactos,
        filaEmail,
        filaTelefono,
      )
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess("Contactos guardados.")
    })
  }

  const handleCrearAcceso = () => {
    setError(null)
    setSuccess(null)
    if (!linkContactoId) {
      setError("Selecciona un contacto guardado (con id).")
      return
    }
    startTransition(async () => {
      const result = await crearAccesoMediaContacto({
        clienteId,
        contactoId: linkContactoId,
        email,
        password,
        passwordConfirm,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(
        "Usuario media_contacto creado y vinculado. Sin correo automático.",
      )
      setPassword("")
      setPasswordConfirm("")
    })
  }

  const handleVincular = () => {
    setError(null)
    setSuccess(null)
    if (!linkContactoId) {
      setError("Selecciona un contacto guardado (con id).")
      return
    }
    startTransition(async () => {
      const result = await vincularAccesoMediaContacto({
        clienteId,
        contactoId: linkContactoId,
        email,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess("Acceso vinculado por email exacto. Sin correo automático.")
    })
  }

  const handleGenerarEnlace = () => {
    setError(null)
    setSuccess(null)
    setCopied(false)
    if (!linkContactoId) {
      setError("Selecciona un contacto con acceso vinculado.")
      return
    }
    startTransition(async () => {
      const result = await generarEnlaceAccesoMediaContacto({
        clienteId,
        contactoId: linkContactoId,
      })
      if (result.error) {
        setError(result.error)
        setAccessLink(null)
        setAccessLinkHint(null)
        return
      }
      if (!result.accessLink) {
        setError("No se recibió un enlace de acceso.")
        return
      }
      setAccessLink(result.accessLink)
      setAccessLinkHint(result.accessLinkExpiryHint ?? null)
      setSuccess(
        "Enlace generado. Cópialo ahora; se retira al cerrar este aviso.",
      )
    })
  }

  const handleCopyLink = async () => {
    if (!accessLink) return
    try {
      await navigator.clipboard.writeText(accessLink)
      setCopied(true)
    } catch {
      setError("No se pudo copiar. Selecciona el enlace manualmente.")
    }
  }

  const handleDismissLink = () => {
    setAccessLink(null)
    setAccessLinkHint(null)
    setCopied(false)
    setSuccess(null)
  }

  const handleDesvincular = (contactoId: string) => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await desvincularAccesoContacto(clienteId, contactoId)
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess("Acceso desvinculado.")
    })
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold">Contactos de la empresa</h2>
        <p className="text-sm text-muted-foreground">
          {MEDIA_CONTACTOS_TABLE_READY
            ? "Varios contactos por empresa. El acceso portal lo crea o vincula un admin."
            : "Esquema vigente: un solo contacto persistible. Multi-contacto tras migración 0024."}
        </p>
      </div>

      <ContactosFields
        contactos={contactos}
        onChange={setContactos}
        enableContactChannels={MEDIA_CONTACTOS_TABLE_READY}
      />

      <Button
        type="button"
        onClick={handleSave}
        disabled={pending}
        aria-label="Guardar contactos"
      >
        {pending ? "Guardando…" : "Guardar contactos"}
      </Button>

      {MEDIA_CONTACTOS_TABLE_READY ? (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium">Acceso portal del contacto</h3>
          <p className="text-xs text-muted-foreground">
            Crear usuario nuevo (rol media_contacto) o vincular uno existente por
            email exacto. El enlace de acceso se genera aparte, sin correo
            automático.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="link-contacto">Contacto</Label>
              <Input
                id="link-contacto"
                className="mt-1"
                value={linkContactoId}
                onChange={(e) => setLinkContactoId(e.target.value)}
                list="contactos-ids"
                aria-label="Id del contacto"
              />
              <datalist id="contactos-ids">
                {contactos
                  .filter((c) => c.id)
                  .map((c) => (
                    <option key={c.id!} value={c.id!}>
                      {c.nombre}
                    </option>
                  ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="acceso-email">Email</Label>
              <Input
                id="acceso-email"
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email del acceso portal"
              />
            </div>
            <div>
              <Label htmlFor="acceso-password">Contraseña (solo crear)</Label>
              <Input
                id="acceso-password"
                type="password"
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                aria-label="Contraseña para crear usuario"
              />
            </div>
            <div>
              <Label htmlFor="acceso-password2">Confirmar contraseña</Label>
              <Input
                id="acceso-password2"
                type="password"
                className="mt-1"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                aria-label="Confirmar contraseña"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleCrearAcceso}
              disabled={pending}
              aria-label="Crear usuario y vincular acceso"
            >
              Crear y vincular
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleVincular}
              disabled={pending}
              aria-label="Vincular usuario existente por email"
            >
              Vincular existente
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerarEnlace}
              disabled={pending}
              aria-label="Generar enlace de acceso"
            >
              Generar enlace de acceso
            </Button>
            {contactos
              .filter((c) => c.id && c.authUserId)
              .map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDesvincular(c.id!)}
                  disabled={pending}
                  aria-label={`Desvincular acceso de ${c.nombre}`}
                >
                  Desvincular {c.nombre}
                </Button>
              ))}
          </div>

          {accessLink ? (
            <div
              className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
              role="status"
              aria-label="Enlace de acceso generado"
            >
              <p className="text-sm font-medium">Enlace de acceso</p>
              <p className="text-xs text-muted-foreground">
                {accessLinkHint ??
                  "Un solo uso. Caduca según la configuración de Auth del proyecto."}{" "}
                Compártelo por el canal que elijas; no se envía correo desde
                aquí. Al cerrar se retira de esta pantalla.
              </p>
              <Input
                readOnly
                value={accessLink}
                className="font-mono text-xs"
                aria-label="Enlace de acceso generado"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCopyLink()}
                  aria-label="Copiar enlace de acceso"
                >
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDismissLink}
                  aria-label="Cerrar y retirar enlace de la interfaz"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success && !accessLink ? (
        <p className="text-sm text-muted-foreground" role="status">
          {success}
        </p>
      ) : null}
      {success && accessLink ? (
        <p className="text-sm text-muted-foreground" role="status">
          {success}
        </p>
      ) : null}
    </section>
  )
}
