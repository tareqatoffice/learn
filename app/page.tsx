import { redirect } from "next/navigation";
import { auth, getProviders } from "@/auth";
import { Landing } from "@/components/Landing";
import { accessStatusFor } from "@/lib/access";
import { ACCESS_PATH } from "@/lib/authz";
import { safeNextPath } from "@/lib/nextPath";
import { buildMetadata } from "@/lib/seo";

const hasDevLogin = () =>
  getProviders().some((p) => typeof p !== "function" && p.id === "credentials");

export const metadata = buildMetadata({
  title: "Learn interview prep, topic by topic",
  path: "/",
});

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const session = await auth();
  const user = session?.user;
  if (user?.id && user.email) {
    const status = await accessStatusFor({ userId: user.id, email: user.email });
    if (status === "approved") redirect(next ?? "/dashboard");
    if (status) redirect(ACCESS_PATH);
  }

  return (
    <Landing
      error={typeof error === "string" ? error : undefined}
      next={next}
      hasDevLogin={hasDevLogin()}
    />
  );
}
