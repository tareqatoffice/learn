import Link from "next/link";

/** The "← Parent" link above a page title; taller on touch screens so it is an easy tap. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:underline pointer-coarse:py-2">
      {children}
    </Link>
  );
}
