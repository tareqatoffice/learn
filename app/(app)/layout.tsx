import { containerClass } from "@/components/AppHeader";
import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { TopBar } from "@/components/TopBar";
import { Toaster } from "@/components/ui/sonner";
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
      <main id="main" tabIndex={-1} className={cn(containerClass, "flex-1 py-6 focus:outline-none")}>{children}</main>
      {/* One of each for the whole signed-in app: the palette opens on ⌘K or the header's button. */}
      <CommandPalette />
      <Toaster />
      <ConfirmHost />
    </>
  );
}
