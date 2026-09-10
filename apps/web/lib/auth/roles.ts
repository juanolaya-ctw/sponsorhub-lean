export const USER_ROLES = ["admin_ct", "sponsor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_HOME = {
  admin_ct: "/admin/selector-evento",
  sponsor: "/portal/dashboard",
} as const satisfies Record<UserRole, string>;

export const LOGIN_PATH = "/login";
export const NO_ACCESS_QUERY = "no_access";
export const NO_ACCESS_MESSAGE =
  "Tu cuenta no tiene acceso configurado. Contacta al equipo de CT.";

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin_ct" || value === "sponsor";
}

export function homeForRole(rol: UserRole): string {
  return ROLE_HOME[rol];
}

export function loginWithNoAccessPath(): string {
  return `${LOGIN_PATH}?error=${NO_ACCESS_QUERY}`;
}

export function parseRol(data: unknown): UserRole | null {
  if (typeof data !== "object" || data === null || !("rol" in data)) {
    return null;
  }

  return isUserRole(data.rol) ? data.rol : null;
}

export function roleFromAccessToken(accessToken: string | undefined): UserRole | null {
  if (!accessToken) return null;

  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("app_metadata" in payload)
    ) {
      return null;
    }

    return parseRol(payload.app_metadata);
  } catch {
    return null;
  }
}

export function isPortalPath(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}
