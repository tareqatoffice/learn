import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null }));
const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT ${path}`); }));
vi.mock("@/auth", () => ({
  auth: async () => (await import("../setup/session")).approvedSession(session.userId),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "UTC" }) }) }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn() }));

import { ExerciseHome } from "@/features/exercise/components/ExerciseHome";
import { ExerciseSetup } from "@/features/exercise/components/ExerciseSetup";
import { connectDb } from "@/lib/db";
import { resetDb } from "../setup/mongo";
import { seedExercises } from "./fixtures";

describe("exercise home", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(async () => {
    await resetDb();
    await seedExercises();
    redirect.mockClear();
    session.userId = String(new Types.ObjectId());
  });
  afterAll(() => mongoose.disconnect());

  it("shows the setup form in place, without a redirect, when the user has no goal yet", async () => {
    const page = await ExerciseHome();
    expect(redirect).not.toHaveBeenCalled();
    expect(page.type).toBe(ExerciseSetup);
    expect(page.props).toEqual({ userId: session.userId });
  });
});
