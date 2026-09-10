import { redirect } from "next/navigation";
import {
  homeForRole,
  LOGIN_PATH,
  loginWithNoAccessPath,
  parseRol,
  roleFromAccessToken,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect(LOGIN_PATH);
  }

  const rol =
    roleFromAccessToken(session.access_token) ??
    parseRol(session.user.app_metadata);
  if (!rol) {
    await supabase.auth.signOut();
    redirect(loginWithNoAccessPath());
  }

  redirect(homeForRole(rol));
}
