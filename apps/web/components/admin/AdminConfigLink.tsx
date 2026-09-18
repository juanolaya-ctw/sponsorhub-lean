"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NON_EVENT_SEGMENTS = new Set([
  "selector-evento",
  "crear-evento",
]);

function eventoSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/([^/]+)/);
  if (!match) return null;
  const slug = match[1];
  if (!slug || NON_EVENT_SEGMENTS.has(slug)) return null;
  return slug;
}

export function AdminConfigLink() {
  const pathname = usePathname();
  const slug = eventoSlugFromPath(pathname);

  if (!slug) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
          >
            <Link href={`/admin/${slug}/estados`} aria-label="Configuración">
              <Settings className="size-4" aria-hidden />
              <span className="hidden sm:inline">Configuración</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Configuración del evento</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
