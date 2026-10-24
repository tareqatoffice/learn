import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/authz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <TopBar user={{ name: user.name, image: user.image, isAdmin: user.isAdmin }} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
    </>
  );
}
