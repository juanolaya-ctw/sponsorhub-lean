"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LOGIN_PATH,
  parseRol,
  roleFromAccessToken,
  type UserRole,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<UserRole, string> = {
  admin_ct: "ColombiaTech · Admin",
  sponsor: "Portal del sponsor",
};

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "SH";
  const first = partes[0];
  if (!first) return "SH";
  if (partes.length === 1) return first.slice(0, 2).toUpperCase();
  const last = partes[partes.length - 1];
  if (!last) return first.slice(0, 2).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

function Dropdown({
  trigger,
  align = "start",
  children,
}: {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[220px] rounded-lg border border-border bg-white py-1 shadow-md",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0",
            align === "start" && "left-0",
          )}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [nombre, setNombre] = useState("SponsorHub");
  const [rol, setRol] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = createClient();

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setNombre(user.email ?? "SponsorHub");
      setRol(
        roleFromAccessToken(session.access_token) ?? parseRol(user.app_metadata),
      );
    })();
  }, []);

  const initials = iniciales(nombre.split("@")[0] ?? nombre);
  const subtitulo = rol ? ROLE_LABEL[rol] : "SponsorHub";
  const showBack =
    (pathname.startsWith("/admin/") && pathname !== "/admin/selector-evento") ||
    (pathname.startsWith("/portal/") && pathname !== "/portal/dashboard");

  function handleBack() {
    if (pathname.startsWith("/admin/")) {
      router.push("/admin/selector-evento");
      return;
    }
    router.push("/portal/dashboard");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-border bg-white px-4">
      {showBack && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Volver"
                onClick={handleBack}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Volver</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dropdown
        align="start"
        trigger={
          <button
            type="button"
            className="flex min-w-0 max-w-[320px] items-center gap-3 text-left"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{nombre}</p>
              <p className="truncate text-sm text-muted-foreground">{subtitulo}</p>
            </div>
          </button>
        }
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </Dropdown>
    </header>
  );
}
