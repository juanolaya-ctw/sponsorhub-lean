"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { aprobarAsset } from "./actions";

export function AprobarAssetButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await aprobarAsset(assetId);
          router.refresh();
        });
      }}
    >
      {pending ? "Aprobando…" : "Aprobar"}
    </Button>
  );
}
