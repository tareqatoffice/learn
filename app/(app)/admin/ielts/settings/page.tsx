import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { IeltsSettingsForm } from "@/features/admin/components/IeltsSettingsForm";
import { getIeltsSettings } from "@/features/ielts/settings";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "IELTS settings · Admin",
  description: "Hours-per-band guide, plan phases and suggestion thresholds.",
  path: "/admin/ielts/settings",
});

export default async function IeltsSettingsPage() {
  const settings = await getIeltsSettings();
  return (
    <AdminPage title="IELTS settings" width="narrow" description="Tune the study plan and when the app suggests changes to it.">
      <AdminCard title="Plan and suggestions">
        <IeltsSettingsForm initial={settings} />
      </AdminCard>
    </AdminPage>
  );
}
