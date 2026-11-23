import { containerClass } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { TopBar } from "@/components/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { requireUser } from "@/features/auth/lib/authz";
import { FocusButton } from "@/features/focus/components/FocusButton";
import { getAppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, { focusPresets }] = await Promise.all([requireUser(), getAppSettings()]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopBar
        user={{ name: user.name, image: user.image, isAdmin: user.isAdmin }}
      />
      <main id="main" tabIndex={-1} className={cn(containerClass, "min-w-0 flex-1 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] focus:outline-none lg:pb-6")}>{children}</main>
      <BottomNav />
      <FocusButton presets={focusPresets} />
      <CommandPalette />
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
