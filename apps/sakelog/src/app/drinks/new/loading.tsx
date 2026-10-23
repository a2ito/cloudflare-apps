import { FormSkeleton, Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-48" />
      <FormSkeleton rows={8} />
    </div>
  );
}
