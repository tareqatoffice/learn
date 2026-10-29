"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GENERIC_MESSAGE = "Something went wrong while loading this page.";

type RouteErrorProps = {
  error: unknown;
  retry: () => void;
  /** Extra home/dashboard link under the retry button. */
  homeHref?: string;
  homeLabel?: string;
  /** Optional second recovery link (e.g. Home beside Dashboard). */
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** User-facing copy: never expose raw messages when a digest exists or in production. */
export function userFacingErrorMessage(
  error: unknown,
  digest?: string,
): string {
  if (digest || process.env.NODE_ENV === "production") return GENERIC_MESSAGE;
  if (error instanceof Error && error.message) return error.message;
  return GENERIC_MESSAGE;
}

export function errorDigest(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as Error & { digest?: unknown }).digest === "string"
  ) {
    return (error as Error & { digest: string }).digest;
  }
  return undefined;
}

/** Shared fallback for `error.tsx` / `global-error.tsx` boundaries. */
export function RouteError({
  error,
  retry,
  homeHref = "/dashboard",
  homeLabel = "Back to dashboard",
  secondaryHref,
  secondaryLabel,
}: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = errorDigest(error);

  return (
    <div className="mx-auto grid max-w-lg gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {userFacingErrorMessage(error, digest)}
      </p>
      {digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
        <Link
          href={homeHref}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {homeLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
