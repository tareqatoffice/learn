import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { LibraryBrowser } from "@/features/exercise/components/LibraryBrowser";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Exercise library",
  description: "Browse bodyweight exercises by focus, type and difficulty.",
  path: "/exercise/library",
});

export default function ExerciseLibraryPage() {
  return (
    <div className="grid w-full gap-6">
      <PageHeader title="Exercise library" track="exercise" />
      <Suspense>
        <LibraryBrowser />
      </Suspense>
    </div>
  );
}
