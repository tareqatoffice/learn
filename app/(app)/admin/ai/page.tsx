import Link from "next/link";
import { AiKeyForm } from "@/features/admin/components/AiKeyForm";
import { AiSettingsForm } from "@/features/admin/components/AiSettingsForm";
import { AdminCard, AdminPage } from "@/features/admin/components/layout";
import { getAiConfig } from "@/features/ai/lib/aiSettings";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { listCatalog } from "@/features/ai/lib/openrouter";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "AI coach · Admin",
  description: "Choose the OpenRouter models behind the AI quiz coach.",
  path: "/admin/ai",
});

export default async function AiSettingsPage() {
  await connectDb();
  const { settings, apiKey } = await getAiConfig();
  const catalog = await listCatalog({ apiKey });
  return (
    <AdminPage
      title="AI coach"
      width="narrow"
      description={
        <>
          The quiz coach grades typed answers and answers follow-up questions through{" "}
          <Link href="https://openrouter.ai/models" className="underline" target="_blank" rel="noreferrer">
            OpenRouter
          </Link>
          .
        </>
      }
    >
      <AdminCard title="OpenRouter API key">
        <AiKeyForm
          source={settings.keySource}
          hint={settings.keyHint}
          updatedAt={settings.keyUpdatedAt ? formatDateTime(settings.keyUpdatedAt) : undefined}
          unreadable={settings.keyUnreadable}
        />
      </AdminCard>
      <AdminCard
        title="Models and limits"
        description="Free models cost nothing but are rate-limited and come and go, so pick a backup: it is used whenever the primary model fails, is busy, or gives a reply the coach cannot read."
      >
        <AiSettingsForm
          initial={{
            enabled: settings.enabled,
            primaryModel: settings.primaryModel,
            fallbackModel: settings.fallbackModel,
            visionModel: settings.visionModel,
            dailyLimit: settings.dailyLimit,
          }}
          keyConfigured={settings.keyConfigured}
          catalog={catalog.models}
          catalogError={catalog.error}
        />
      </AdminCard>
    </AdminPage>
  );
}
