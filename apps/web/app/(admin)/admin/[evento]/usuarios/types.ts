export type SponsorOption = {
  id: string;
  nombre: string;
};

export type UsuarioRow = {
  id: string;
  nombre: string | null;
  cargo: string | null;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  sponsorId: string;
  sponsorNombre: string;
  email: string | null;
  lastSignInAt: string | null;
};
