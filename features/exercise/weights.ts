import { connectDb, retryOnDuplicateKey } from "@/lib/db";
import { WeightEntry } from "@/models";
import { type ActionResult, fail, ok } from "@/features/admin/result";
import { isRealDate } from "./date";
import { getActiveProfile } from "./profile";

export async function logWeight(
  userId: string,
  date: string,
  kg: number,
  today: string,
): Promise<ActionResult<{ date: string; kg: number }>> {
  if (!Number.isFinite(kg) || kg < 30 || kg > 300) return fail({ kg: "Weight must be between 30 and 300 kg." });
  if (!isRealDate(date) || date > today) return fail({ date: "Pick today or an earlier day." });
  const profile = await getActiveProfile(userId);
  if (!profile) return fail("Set a goal before logging your weight.");
  if (date < profile.startDate) return fail({ date: `Pick ${profile.startDate} or later: that is when this goal started.` });
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
  if (!isRealDate(date)) return fail({ date: "Pick a valid day." });
  await connectDb();
  await WeightEntry.deleteOne({ userId, date });
  return ok();
}
