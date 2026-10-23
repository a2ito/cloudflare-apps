import { Skeleton, WineCardSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <WineCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
