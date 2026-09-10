"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "sponsorhub-archivos";

export function DownloadButton({
  path,
  filename,
}: {
  path: string;
  filename: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60, { download: filename });

    if (signedUrlError) {
      setError(signedUrlError.message);
      setPending(false);
      return;
    }

    window.location.assign(data.signedUrl);
    setPending(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void download()}>
        {pending ? "Preparando…" : "Descargar"}
      </Button>
      {error ? <p className="max-w-56 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
