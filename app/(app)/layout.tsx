import { containerClass } from "@/components/AppHeader";
import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/authz";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

// Everything under (app) needs a sign-in, so keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <TopBar
        user={{ name: user.name, image: user.image, isAdmin: user.isAdmin }}
      />
      <main className={cn(containerClass, "flex-1 py-6")}>{children}</main>
    </>
  );
}
