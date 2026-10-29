import { AppHeader, containerClass } from "@/components/AppHeader";
import { SimplePageSkeleton } from "@/components/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Loading() {
  return (
    <>
      <AppHeader>
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </AppHeader>
      <main
        className={cn(
          containerClass,
          "flex flex-1 items-start justify-center py-10 sm:items-center",
        )}
      >
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <SimplePageSkeleton />
        </div>
      </main>
    </>
  );
}
