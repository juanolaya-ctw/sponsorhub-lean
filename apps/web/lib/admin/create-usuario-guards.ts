/** Mensaje estable cuando el sponsor no pertenece al evento del formulario. */
export const SPONSOR_NOT_IN_EVENTO =
  "El sponsor no pertenece a este evento."

export const CREATE_USUARIO_FORBIDDEN =
  "No autorizado para crear usuarios del portal."

/** True solo si el sponsor está anclado al mismo evento que se envía al action. */
export const sponsorBelongsToEvento = (
  sponsorEventoId: string | null | undefined,
  eventoId: string,
): boolean =>
  Boolean(
    sponsorEventoId &&
      eventoId &&
      sponsorEventoId === eventoId,
  )

export const messageIfSponsorOutsideEvento = (
  sponsorEventoId: string | null | undefined,
  eventoId: string,
): string | null =>
  sponsorBelongsToEvento(sponsorEventoId, eventoId)
    ? null
    : SPONSOR_NOT_IN_EVENTO

/** Gate de rol: solo admin_ct crea usuarios portal (sin ampliar permisos). */
export const messageIfCannotCreateUsuario = (
  rol: string | null | undefined,
): string | null =>
  rol === "admin_ct" ? null : CREATE_USUARIO_FORBIDDEN

export type SponsorConEvento = {
  id: string
  nombre: string
  eventoId: string
  eventoSlug: string
  eventoNombre: string
}

/** Resuelve destino de la vista por evento sin duplicar createUsuario. */
export const buildCrearUsuarioEventoHref = (
  sponsor: Pick<SponsorConEvento, "id" | "eventoSlug">,
): string =>
  `/admin/${encodeURIComponent(sponsor.eventoSlug)}/usuarios` +
  `?crear=1&sponsorId=${encodeURIComponent(sponsor.id)}`
