"use client";

import { RouteError } from "@/components/RouteError";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  // Layout failures under (app) bubble here; keep Dashboard as the primary recovery path.
  return (
    <RouteError
      error={error}
      retry={retry}
      secondaryHref="/"
      secondaryLabel="Home"
    />
  );
}
