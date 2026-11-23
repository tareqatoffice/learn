import { AppSettingsForm } from "@/features/admin/components/AppSettingsForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { getAppSettings } from "@/lib/appSettings";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "General settings · Admin",
  description: "Focus timer presets and the weekly workout rotation.",
  path: "/admin/settings",
});

export default async function AppSettingsPage() {
  const settings = await getAppSettings();
  return (
    <AdminPage title="General settings" width="narrow" description="Site-wide tunables for the focus timer and workout plans.">
      <AdminCard title="Focus and workouts">
        <AppSettingsForm initial={settings} />
      </AdminCard>
    </AdminPage>
  );
}
