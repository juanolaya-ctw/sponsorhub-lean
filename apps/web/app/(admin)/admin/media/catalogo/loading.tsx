import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogoLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-1 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-border px-4 py-3 last:border-b-0">
            <div className="grid grid-cols-5 gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
