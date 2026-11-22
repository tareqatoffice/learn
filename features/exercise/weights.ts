import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { WeightEntry } from "@/models";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { getActiveProfile } from "./profile";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function logWeight(
  userId: string,
  date: string,
  kg: number,
  today: string,
): Promise<ActionResult<{ date: string; kg: number }>> {
  if (!Number.isFinite(kg) || kg <= 0 || kg > 400) return fail({ kg: "Enter a weight between 0 and 400 kg." });
  if (!DATE.test(date) || date > today) return fail({ date: "Pick today or an earlier day." });
  const profile = await getActiveProfile(userId);
  if (!profile) return fail("Set a goal before logging your weight.");
  await retryOnDuplicateKey(() =>
    WeightEntry.updateOne({ userId, date }, { $set: { kg, profileId: profile.id } }, { upsert: true }),
  );
  return ok({ date, kg });
}

export async function listWeights(userId: string, profileId: string): Promise<{ date: string; kg: number }[]> {
  await connectDb();
  const rows = await WeightEntry.find({ userId, profileId }).sort({ date: 1 }).select("date kg").lean<{ date: string; kg: number }[]>();
  return rows.map((r) => ({ date: r.date, kg: r.kg }));
}

export async function deleteWeight(userId: string, date: string): Promise<ActionResult> {
  await connectDb();
  await WeightEntry.deleteOne({ userId, date });
  return ok();
}
