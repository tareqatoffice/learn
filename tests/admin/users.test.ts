import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", () => ({
  storageConfigured: vi.fn(() => true),
  presignPut: vi.fn(),
  presignGet: vi.fn(),
  headObject: vi.fn(),
  deleteObjects: vi.fn(async () => undefined),
  getObjectBytes: vi.fn(),
}));

vi.mock("@/features/exercise/data", async (orig) => ({
  ...(await orig<typeof import("@/features/exercise/data")>()),
  deleteAllExerciseData: vi.fn(),
}));

import { deleteAllExerciseData } from "@/features/exercise/data";
import { deleteUser } from "@/features/admin/users";
import { connectDb } from "@/lib/db";
import { resetEnvCache } from "@/lib/env";
import * as r2 from "@/lib/r2";
import { FocusPlan, FocusReview, IeltsStudyLog, NoteProgress, NoteRecitation, QuizSession, SpeakingTake, User } from "@/models";
import { resetDb } from "../setup/mongo";

const media = { kind: "audio", key: "takes/u/t.webm", mime: "audio/webm", durationSec: 5, capSec: 60, stored: true };

beforeAll(connectDb);
beforeEach(async () => {
  await resetDb();
  vi.stubEnv("ADMIN_EMAILS", "owner@example.test");
  resetEnvCache();
  vi.mocked(r2.deleteObjects).mockReset().mockResolvedValue(undefined);
  const real = (await vi.importActual<typeof import("@/features/exercise/data")>("@/features/exercise/data")).deleteAllExerciseData;
  vi.mocked(deleteAllExerciseData).mockReset().mockImplementation(real);
});
afterAll(() => mongoose.disconnect());

async function userWithData(email: string) {
  const u = await User.create({ email, name: email, status: "approved" });
  const userId = u._id as Types.ObjectId;
  await SpeakingTake.create({ userId, date: "2026-11-12", task: "readAloud", media });
  await NoteProgress.create({ userId, noteId: new Types.ObjectId(), seriesId: new Types.ObjectId(), read: true });
  await NoteRecitation.create({ userId, noteId: new Types.ObjectId(), anchor: "intro", text: "Main idea", verdict: "got" });
  await FocusReview.create({ userId, weekStart: "2026-11-23", helped: "Phone away" });
  await FocusPlan.create({ userId, time: "19:00", action: "read", minutes: 25 });
  await QuizSession.create({ userId, filter: { bookIds: [], partKeys: [], mode: "all" }, questionIds: [], cursor: 0, results: [] });
  await IeltsStudyLog.create({ userId, date: "2026-11-12", skill: "reading", minutes: 20 });
  return String(userId);
}

describe("deleteUser (F23)", () => {
  it("removes the user, their recordings and every progress row, and nobody else's", async () => {
    const id = await userWithData("a@example.test");
    const other = await userWithData("b@example.test");
    expect(await deleteUser(id)).toEqual({ ok: true, id });
    expect(r2.deleteObjects).toHaveBeenCalledWith(["takes/u/t.webm"]);
    for (const M of [SpeakingTake, NoteProgress, NoteRecitation, FocusReview, FocusPlan, QuizSession, IeltsStudyLog]) {
      expect(await M.countDocuments({ userId: id })).toBe(0);
      expect(await M.countDocuments({ userId: other })).toBe(1);
    }
    expect(await User.exists({ _id: id })).toBeNull();
  });

  it("keeps everything when storage can't delete the recordings, and refuses admins", async () => {
    const id = await userWithData("a@example.test");
    vi.mocked(r2.deleteObjects).mockRejectedValueOnce(new Error("r2 down"));
    expect((await deleteUser(id)).ok).toBe(false);
    expect(await SpeakingTake.countDocuments({ userId: id })).toBe(1);
    expect(await User.exists({ _id: id })).toBeTruthy();
    const admin = await User.create({ email: "owner@example.test", name: "Owner" });
    expect((await deleteUser(String(admin._id))).ok).toBe(false);
  });

  it("says what was already removed when the exercise data delete fails", async () => {
    const id = await userWithData("a@example.test");
    vi.mocked(deleteAllExerciseData).mockRejectedValueOnce(new Error("db down"));
    expect(await deleteUser(id)).toEqual({
      ok: false,
      errors: {
        _: "Couldn't delete the user's exercise data. Their recordings and IELTS data were already removed. Try again to finish deleting the user.",
      },
    });
    expect(await User.exists({ _id: id })).toBeTruthy();
  });
});
