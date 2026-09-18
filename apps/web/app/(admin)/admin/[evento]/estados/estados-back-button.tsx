"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EstadosBackButton({
  fallbackHref,
}: {
  fallbackHref: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mb-2 -ml-2 gap-1.5 text-muted-foreground"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="size-4" aria-hidden />
      Volver
    </Button>
  );
}
