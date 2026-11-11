import Link from "next/link";
import { SpeakingSettingsForm } from "@/components/speaking/SpeakingSettingsForm";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { pageTitleClass } from "@/lib/ui";
import { getEffectiveSettings } from "@/speaking/settings";

export const metadata = buildMetadata({
  title: "Speaking settings",
  description: "Daily targets, which speaking tasks are on, video defaults and body-language consent.",
  path: "/speaking/settings",
});

export default async function SpeakingSettingsPage() {
  const user = await requireUser();
  await connectDb();
  const settings = await getEffectiveSettings(user.userId);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <Link href="/speaking" className="text-sm text-muted-foreground hover:underline">
          ← Speaking practice
        </Link>
        <h1 className={pageTitleClass}>Speaking settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Targets are minutes a day; many short takes add up.</p>
      </div>
      <SpeakingSettingsForm settings={settings} />
    </div>
  );
}
