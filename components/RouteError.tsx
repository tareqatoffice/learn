"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GENERIC_MESSAGE = "Something went wrong while loading this page.";

type RouteErrorProps = {
  error: unknown;
  retry: () => void;
  homeHref?: string;
  homeLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const TURBOPACK_MODULE = /__TURBOPACK__imported__module__((?:\$[0-9a-f]+\$|[\w.-])+?)__(?=\.)/gi;

function decodeTurbopackModule(id: string): string {
  return id
    .replace(/\$([0-9a-f]+)\$/gi, (_, hex: string) =>
      (hex.match(/../g) ?? []).map((h) => String.fromCharCode(parseInt(h, 16))).join(""),
    )
    .replace(/__/g, " ")
    .replace(/^\[project\]\//, "")
    .replace(/\s*\[[\w-]+\]\s*\([\w-]+\)\s*$/, "")
    .trim();
}

export function readableErrorMessage(message: string): string {
  if (!message.includes("__TURBOPACK__imported__module__")) return message;
  const readable = message
    .replace(TURBOPACK_MODULE, (_, id: string) => `@@${decodeTurbopackModule(id)}@@`)
    .replace(/\(0\s*,\s*@@(.+?)@@\.(\w+)\)/g, '"$2" from $1')
    .replace(/@@(.+?)@@\.(\w+)/g, '"$2" from $1')
    .replace(/@@(.+?)@@/g, "$1");
  return `${readable}. The dev bundle may be stale; restart the dev server if the code looks right.`;
}

export function userFacingErrorMessage(
  error: unknown,
  digest?: string,
): string {
  if (digest || process.env.NODE_ENV === "production") return GENERIC_MESSAGE;
  if (error instanceof Error && error.message) return readableErrorMessage(error.message);
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
    <div
      role="alert"
      className="flex min-h-[60vh] w-full flex-1 items-center justify-center px-4 py-16"
    >
    <div className="grid w-full min-w-0 max-w-lg gap-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
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
    </div>
  );
}
