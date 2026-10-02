"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Tv2, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin/media", label: "Clientes", icon: Tv2 },
  { href: "/admin/media/catalogo", label: "Catálogo", icon: Package },
  { href: "/admin/media/planes", label: "Planes", icon: Zap },
];

function MediaSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-4 py-4">
        <Link
          href="/admin/selector-evento"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Volver a eventos
        </Link>
        <p className="mt-1 font-semibold leading-tight">CT Media</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {LINKS.map((link) => {
          const active =
            link.href === "/admin/media"
              ? pathname === "/admin/media" || pathname.startsWith("/admin/media/nuevo") || (pathname.startsWith("/admin/media/") && !pathname.startsWith("/admin/media/catalogo") && !pathname.startsWith("/admin/media/planes"))
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
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

export default function MediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <MediaSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
