import { type AppSettingsView, resolveAppSettings } from "@/lib/appSettingsConfig";
import { connectDb } from "@/lib/db";
import { AppSettings } from "@/models";

export * from "@/lib/appSettingsConfig";

export async function getAppSettings(): Promise<AppSettingsView> {
  await connectDb();
  return resolveAppSettings(await AppSettings.findOne({ key: "default" }).lean<Partial<AppSettingsView>>());
}
