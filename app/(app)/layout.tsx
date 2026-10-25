import { containerClass } from "@/components/AppHeader";
import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/authz";
import { cn } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <TopBar user={{ name: user.name, image: user.image, isAdmin: user.isAdmin }} />
      <main className={cn(containerClass, "flex-1 py-6")}>{children}</main>
    </>
  );
}
