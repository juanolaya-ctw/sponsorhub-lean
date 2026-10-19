"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type { SponsorDuplicateCandidate } from "@/lib/notion/merge-sponsors"
import { mergeSponsorDuplicate } from "./actions"

export function SponsorDuplicatesPanel({
  eventoSlug,
  initialCandidates,
}: {
  eventoSlug: string
  initialCandidates: SponsorDuplicateCandidate[]
}) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (candidates.length === 0) return null

  return (
    <section className="mt-8 rounded-xl border border-amber-600/30 bg-amber-50/50 p-4">
      <h2 className="text-sm font-semibold text-amber-950">
        Sponsors duplicados detectados
      </h2>
      <p className="mt-1 text-xs text-amber-900/80">
        Mismo nombre normalizado. Fusionar mueve datos al sponsor canónico y
        archiva el vacío.
      </p>
      <ul className="mt-3 space-y-2">
        {candidates.map((item) => (
          <li
            key={`${item.keepId}-${item.archiveId}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-600/20 bg-white px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                Archivar «{item.archiveNombre}» → conservar «{item.keepNombre}»
              </p>
              <p className="text-xs text-muted-foreground">{item.reason}</p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Fusionar ${item.archiveNombre} en ${item.keepNombre}?`,
                  )
                ) {
                  return
                }
                setError(null)
                startTransition(async () => {
                  const result = await mergeSponsorDuplicate(
                    item.keepId,
                    item.archiveId,
                    eventoSlug,
                  )
                  if (result.error) {
                    setError(result.error)
                    return
                  }
                  setCandidates((prev) =>
                    prev.filter(
                      (c) =>
                        !(
                          c.keepId === item.keepId &&
                          c.archiveId === item.archiveId
                        ),
                    ),
                  )
                })
              }}
            >
              Fusionar
            </Button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
