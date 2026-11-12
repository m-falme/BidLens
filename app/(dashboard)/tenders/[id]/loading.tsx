import { Skeleton } from "@/components/ui/skeleton";

export default function TenderLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" aria-busy aria-label="Loading tender">
      <div className="space-y-2">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-3/4" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
