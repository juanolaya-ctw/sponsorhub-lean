import { Skeleton } from "@/components/ui/skeleton";

export default function ClienteMediaLoading() {
  return (
    <div>
      {/* Back link + header */}
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Balance card */}
      <div className="mt-6 rounded-xl border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      {/* Assets table */}
      <div className="mt-6">
        <Skeleton className="mb-3 h-5 w-40" />
        <div className="rounded-xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-border px-4 py-3 last:border-b-0">
              <div className="grid grid-cols-4 gap-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-32 rounded-md" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-8 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
