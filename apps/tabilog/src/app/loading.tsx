import { Skeleton, TripCardSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <TripCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
