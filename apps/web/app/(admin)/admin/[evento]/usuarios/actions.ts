"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type UsuarioActionState = {
  error: string | null;
  success?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalText(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function revalidateUsuarios(slug: string) {
  revalidatePath(`/admin/${slug}/usuarios`);
}

async function assertSponsorInEvento(
  admin: ReturnType<typeof createAdminClient>,
  sponsorId: string,
  eventoId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("sponsors")
    .select("id")
    .eq("id", sponsorId)
    .eq("evento_id", eventoId)
    .maybeSingle();

  if (error) return error.message;
  if (!data) return "El sponsor no pertenece a este evento.";
  return null;
}

async function assertUsuarioSponsorInEvento(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  eventoId: string,
): Promise<{ error: string | null }> {
  const { data, error } = await admin
    .from("sponsor_usuarios")
    .select("id, rol, sponsors!inner(evento_id)")
    .eq("id", userId)
    .eq("rol", "sponsor")
    .eq("sponsors.evento_id", eventoId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Usuario no encontrado en este evento." };
  return { error: null };
}

export async function createUsuario(
  _prev: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const slug = String(formData.get("slug") ?? "").trim();
  const eventoId = String(formData.get("evento_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const sponsorId = String(formData.get("sponsor_id") ?? "").trim();
  const nombre = optionalText(formData.get("nombre"));
  const cargo = optionalText(formData.get("cargo"));
  const telefono = optionalText(formData.get("telefono"));
  const notas = optionalText(formData.get("notas"));

  if (!slug || !eventoId) {
    return { error: "Falta el evento." };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "El email no es válido." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (!sponsorId) {
    return { error: "Debes vincular un sponsor." };
  }

  const sponsorError = await assertSponsorInEvento(admin, sponsorId, eventoId);
  if (sponsorError) return { error: sponsorError };

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    return {
      error: authError?.message ?? "No se pudo crear el usuario en Auth.",
    };
  }

  const userId = authData.user.id;
  const { error: insertError } = await admin.from("sponsor_usuarios").insert({
    id: userId,
    sponsor_id: sponsorId,
    rol: "sponsor",
    activo: true,
    nombre,
    cargo,
    telefono,
    notas,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: insertError.message };
  }

  revalidateUsuarios(slug);
  return { error: null, success: true };
}

export async function updateUsuario(
  _prev: UsuarioActionState,
  formData: FormData,
): Promise<UsuarioActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const slug = String(formData.get("slug") ?? "").trim();
  const eventoId = String(formData.get("evento_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const sponsorId = String(formData.get("sponsor_id") ?? "").trim();
  const nombre = optionalText(formData.get("nombre"));
  const cargo = optionalText(formData.get("cargo"));
  const telefono = optionalText(formData.get("telefono"));
  const notas = optionalText(formData.get("notas"));
  const emailRaw = optionalText(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!slug || !eventoId) {
    return { error: "Falta el evento." };
  }
  if (!userId) {
    return { error: "Falta el usuario." };
  }
  if (!sponsorId) {
    return { error: "Debes vincular un sponsor." };
  }

  const ownership = await assertUsuarioSponsorInEvento(admin, userId, eventoId);
  if (ownership.error) return { error: ownership.error };

  const sponsorError = await assertSponsorInEvento(admin, sponsorId, eventoId);
  if (sponsorError) return { error: sponsorError };

  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    return { error: "El email no es válido." };
  }
  if (password && password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const { error: updateError } = await admin
    .from("sponsor_usuarios")
    .update({
      nombre,
      cargo,
      telefono,
      notas,
      sponsor_id: sponsorId,
    })
    .eq("id", userId)
    .eq("rol", "sponsor");

  if (updateError) {
    return { error: updateError.message };
  }

  const authPatch: { email?: string; password?: string; email_confirm?: true } =
    {};
  if (emailRaw) {
    authPatch.email = emailRaw.toLowerCase();
    authPatch.email_confirm = true;
  }
  if (password) {
    authPatch.password = password;
  }

  if (Object.keys(authPatch).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      userId,
      authPatch,
    );
    if (authError) {
      return { error: authError.message };
    }
  }

  revalidateUsuarios(slug);
  return { error: null, success: true };
}

export async function toggleUsuarioActivo(
  userId: string,
  eventoId: string,
  slug: string,
  activo: boolean,
): Promise<UsuarioActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const ownership = await assertUsuarioSponsorInEvento(admin, userId, eventoId);
  if (ownership.error) return { error: ownership.error };

  const { error } = await admin
    .from("sponsor_usuarios")
    .update({ activo })
    .eq("id", userId)
    .eq("rol", "sponsor");

  if (error) {
    return { error: error.message };
  }

  revalidateUsuarios(slug);
  return { error: null, success: true };
}

export async function deleteUsuario(
  userId: string,
  eventoId: string,
  slug: string,
): Promise<UsuarioActionState> {
  await requireAdmin();
  const admin = createAdminClient();

  const ownership = await assertUsuarioSponsorInEvento(admin, userId, eventoId);
  if (ownership.error) return { error: ownership.error };

  const { error: deleteError } = await admin
    .from("sponsor_usuarios")
    .delete()
    .eq("id", userId)
    .eq("rol", "sponsor");

  if (deleteError) {
    return { error: deleteError.message };
  }

  // Si Auth falla, la fila ya no existe — huérfano aceptable (limpieza manual).
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    return {
      error: `Usuario eliminado de la base, pero Auth falló: ${authError.message}`,
    };
  }

  revalidateUsuarios(slug);
  return { error: null, success: true };
}
