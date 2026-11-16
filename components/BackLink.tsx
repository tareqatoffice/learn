import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:underline pointer-coarse:py-2">
      {children}
    </Link>
  );
}
