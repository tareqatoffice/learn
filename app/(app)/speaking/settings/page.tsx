import Link from "next/link";
import { DeleteAllTakes } from "@/features/speaking/components/DeleteAllTakes";
import { SpeakingSettingsForm } from "@/features/speaking/components/SpeakingSettingsForm";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { getEffectiveSettings } from "@/features/speaking/settings";

export const metadata = buildMetadata({
  title: "Speaking settings",
  description: "Daily targets, which speaking tasks are on, video defaults, body-language consent and your recordings.",
  path: "/speaking/settings",
});

export default async function SpeakingSettingsPage() {
  const user = await requireUser();
  await connectDb();
  const settings = await getEffectiveSettings(user.userId);

  return (
    <div className="grid w-full gap-6">
      <div>
        <Link href="/speaking" className="text-sm text-muted-foreground hover:underline">
          ← Speaking practice
        </Link>
        <h1 className={pageTitleClass}>Speaking settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Targets are minutes a day; many short takes add up.</p>
      </div>
      <SpeakingSettingsForm settings={settings} />
      <DeleteAllTakes />
    </div>
  );
}
