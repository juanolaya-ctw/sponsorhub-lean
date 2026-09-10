import { NextResponse, type NextRequest } from "next/server";
import {
  homeForRole,
  isAdminPath,
  isLoginPath,
  isPortalPath,
  LOGIN_PATH,
  loginWithNoAccessPath,
  parseRol,
  roleFromAccessToken,
} from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, session } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const hasUser = Boolean(session?.user);
  const rol =
    roleFromAccessToken(session?.access_token) ??
    parseRol(session?.user.app_metadata);

  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    return copySessionCookies(supabaseResponse, response);
  };

  // Cron y APIs internas autentican por su cuenta (ej. CRON_SECRET).
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (hasUser && !rol) {
    // Token anterior a la activación del hook: los layouts protegidos
    // ejecutan un único fallback a sponsor_usuarios. El middleware sigue
    // sin consultar la base de datos.
    if (isAdminPath(pathname) || isPortalPath(pathname)) {
      return supabaseResponse;
    }

    if (isLoginPath(pathname)) {
      return supabaseResponse;
    }

    return redirectTo(loginWithNoAccessPath());
  }

  if (!hasUser) {
    if (pathname === "/" || isPortalPath(pathname) || isAdminPath(pathname)) {
      return redirectTo(LOGIN_PATH);
    }
    return supabaseResponse;
  }

  if (!rol) {
    return redirectTo(loginWithNoAccessPath());
  }

  const home = homeForRole(rol);

  if (pathname === "/" || isLoginPath(pathname)) {
    return redirectTo(home);
  }

  if (isAdminPath(pathname) && rol !== "admin_ct") {
    return redirectTo(home);
  }

  if (isPortalPath(pathname) && rol !== "sponsor") {
    return redirectTo(home);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
