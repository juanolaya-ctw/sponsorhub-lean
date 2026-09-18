"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ClipboardList,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
}> = [
  { href: "sponsors", label: "Sponsors", icon: Building2 },
  { href: "compromisos", label: "Compromisos", icon: ClipboardList },
  { href: "usuarios", label: "Usuarios", icon: Users },
  { href: "alertas", label: "Alertas", icon: Bell },
];

export function EventSidebar({
  slug,
  nombre,
}: {
  slug: string;
  nombre: string;
}) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <Link
          href="/admin/selector-evento"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cambiar evento
        </Link>
        <p className="mt-1 font-semibold leading-tight">{nombre}</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {LINKS.map((link) => {
          const href = `${base}/${link.href}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
