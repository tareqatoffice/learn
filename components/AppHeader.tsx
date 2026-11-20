import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const containerClass = "mx-auto w-full min-w-0 max-w-[75rem] px-4 sm:px-6 lg:px-8";

function Brand() {
  return (
    <Image src="/logo.svg" alt="Learn" width={28} height={28} unoptimized className="size-7" />
  );
}

export function AppHeader({
  logoHref,
  children,
}: {
  logoHref?: string;
  children: React.ReactNode;
}) {
  const logoClass = "mr-3 py-2 text-lg font-bold tracking-tight";
  return (
    <header className="min-w-0 overflow-x-clip border-b border-border bg-card sticky top-0 z-40">
      <div className={cn(containerClass, "flex h-14 min-w-0 items-center gap-2")}>
        {logoHref ? (
          <Link
            href={logoHref}
            className={cn(
              logoClass,
              "shrink-0 transition-colors hover:text-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <Brand />
          </Link>
        ) : (
          <span className={cn(logoClass, "shrink-0")}>
            <Brand />
          </span>
        )}
        {children}
      </div>
    </header>
  );
}
