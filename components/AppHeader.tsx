import Link from "next/link";
import { cn } from "@/lib/utils";

/** Page width and gutters shared by the header row and every page's <main>, so they line up. */
export const containerClass = "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8";

/**
 * The sticky header shell: the "Learn" mark plus whatever controls the caller puts beside it.
 * TopBar fills it with navigation and the account menu; the sign-in page with just the theme toggle.
 */
export function AppHeader({
  logoHref,
  children,
  below,
}: {
  /** Makes the mark a link; omitted on the sign-in page, where there is nowhere to go yet. */
  logoHref?: string;
  children: React.ReactNode;
  /** Rendered under the header row, inside the sticky header (TopBar's mobile menu). */
  below?: React.ReactNode;
}) {
  const logoClass = "mr-3 py-2 text-lg font-bold tracking-tight";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className={cn(containerClass, "flex h-14 items-center gap-2")}>
        {logoHref ? (
          <Link
            href={logoHref}
            className={cn(
              logoClass,
              "transition-colors hover:text-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            Learn
          </Link>
        ) : (
          <span className={logoClass}>Learn</span>
        )}
        {children}
      </div>
      {below}
    </header>
  );
}
