import { DeleteAllTakes } from "@/features/speaking/components/DeleteAllTakes";
import { SpeakingSettingsForm } from "@/features/speaking/components/SpeakingSettingsForm";
import { requireUser } from "@/features/auth/lib/authz";
import { connectDb } from "@/lib/db";
import { buildMetadata } from "@/lib/seo";
import { getEffectiveSettings } from "@/features/speaking/settings";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";

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
      <div className="grid gap-3">
        <BackLink href="/speaking">← Speaking practice</BackLink>
        <PageHeader
          title="Speaking settings"
          track="speaking"
          description="Targets are minutes a day; many short takes add up."
        />
      </div>
      <SpeakingSettingsForm settings={settings} />
      <DeleteAllTakes />
    </div>
  );
}
