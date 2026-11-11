import { connectDb } from "@/lib/db";
import { IeltsSpeakingAttempt, IeltsStudyLog, SpeakingTake } from "@/models";
import { type ActionResult, fail, ok } from "@/admin/result";
import { CRITERION_LABEL, SKILLS, type Skill } from "@/ielts/bands";
import { type Week, studyDaysBetween, weekOn } from "@/ielts/plan";
import { currentPlan, getProfile, type PlanView } from "@/ielts/profile";
import { addDays, localDate } from "@/speaking/schedule";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRACTICE_SHARE = 0.5;
const DEFAULT_MOCK_MINUTES = 15;
/** The second mock of a week waits this many days after the first. */
const MOCK_GAP_DAYS = 3;

export type TodayItem = {
  id: string;
  skill: Skill;
  kind: "drill" | "mock" | "log";
  label: string;
  minutes: number;
  done: boolean;
  href?: string;
};

type DayTotals = Record<string, Record<Skill, number>>;

const empty = (): Record<Skill, number> => ({ listening: 0, reading: 0, writing: 0, speaking: 0 });
const isRealDate = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && addDays(d, 0) === d;
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;

function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Per-day minutes over an inclusive range of learner-local dates: stored IELTS recordings plus logged study. */
export async function dailyMinutes(userId: string, from: string, to: string): Promise<DayTotals> {
  const out: DayTotals = Object.fromEntries(dayRange(from, to).map((d) => [d, empty()]));
  if (from > to) return out;
  await connectDb();
  const match = { userId, date: { $gte: from, $lte: to } };
  const [attempts, logs] = await Promise.all([
    IeltsSpeakingAttempt.find(match)
      .select("date parts.media")
      .lean<{ date: string; parts: { media: { durationSec: number; stored?: boolean } }[] }[]>(),
    IeltsStudyLog.find(match).select("date skill minutes").lean<{ date: string; skill: Skill; minutes: number }[]>(),
  ]);
  for (const a of attempts) {
    for (const p of a.parts) if (p.media.stored) out[a.date].speaking += p.media.durationSec / 60;
  }
  for (const l of logs) out[l.date][l.skill] += l.minutes;
  return out;
}

async function practiceMinutes(userId: string, from: string, to: string): Promise<number> {
  if (from > to) return 0;
  const takes = await SpeakingTake.find({ userId, date: { $gte: from, $lte: to }, "media.stored": true })
    .select("media.durationSec")
    .lean<{ media: { durationSec: number } }[]>();
  return takes.reduce((s, t) => s + t.media.durationSec / 60, 0);
}

async function completeMockDates(userId: string, from: string, to: string): Promise<string[]> {
  if (from > to) return [];
  const rows = await IeltsSpeakingAttempt.find({ userId, kind: "mock", status: "complete", date: { $gte: from, $lte: to } })
    .select("date")
    .lean<{ date: string }[]>();
  return rows.map((r) => r.date).sort();
}

/** Progress in `week` counting only dates up to `through`. */
async function progressThrough(userId: string, week: Week, through: string, timeZone: string) {
  const to = through < week.end ? through : week.end;
  const days = await dailyMinutes(userId, week.start, to);
  const done = empty();
  for (const d of Object.values(days)) for (const s of SKILLS) done[s] += d[s];

  const profile = await getProfile(userId);
  let fromPractice = 0;
  if (profile) {
    const created = localDate(new Date(profile.createdAt), timeZone);
    const practice = await practiceMinutes(userId, created > week.start ? created : week.start, to);
    fromPractice = Math.min(practice, week.minutes.speaking * PRACTICE_SHARE);
  }
  done.speaking += fromPractice;
  const mockDates = await completeMockDates(userId, week.start, to);
  return { done, fromPractice, mocksDone: mockDates.length, mockDates };
}

/** Week totals. Speaking = IELTS recordings + Speaking Practice (from the profile's creation day, capped at 50 % of the target). */
export async function weekProgress(
  userId: string,
  plan: Pick<PlanView, "weeks">,
  weekIndex: number,
  timeZone: string,
): Promise<{ done: Record<Skill, number>; fromPractice: number; mocksDone: number }> {
  const week = plan.weeks[weekIndex];
  if (!week) return { done: empty(), fromPractice: 0, mocksDone: 0 };
  const { done, fromPractice, mocksDone } = await progressThrough(userId, week, week.end, timeZone);
  return { done, fromPractice, mocksDone };
}

const SKILL_NAME: Record<Skill, string> = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };

export async function todayList(userId: string, today: string, timeZone: string): Promise<TodayItem[]> {
  const [profile, plan] = await Promise.all([getProfile(userId), currentPlan(userId)]);
  if (!profile || !plan || profile.status !== "active") return [];
  if (!profile.studyDays.includes(weekday(today))) return [];
  const found = weekOn(plan, today);
  if (!found) return [];
  const { week } = found;

  // Targets are set from what was done before today, so an item doesn't shrink as it is completed.
  const before = await progressThrough(userId, week, addDays(today, -1), timeZone);
  const daysLeft = Math.max(1, studyDaysBetween(today, week.end, profile.studyDays));

  // The first mock is re-offered on every study day until done; the second waits for the gap after the first.
  const mock =
    before.mocksDone < week.mocks && (before.mocksDone === 0 || today >= addDays(before.mockDates[0], MOCK_GAP_DAYS));

  const wanted = Object.fromEntries(
    SKILLS.map((s) => [s, roundUp5(Math.max(0, week.minutes[s] - before.done[s]) / daysLeft)]),
  ) as Record<Skill, number>;
  // A mock takes time even when the Speaking share is spent, so it counts toward the daily cap.
  if (mock) wanted.speaking = Math.max(wanted.speaking, DEFAULT_MOCK_MINUTES);
  const total = SKILLS.reduce((s, k) => s + wanted[k], 0);
  const scale = total > profile.minutesPerDay ? profile.minutesPerDay / total : 1;
  const minutes = Object.fromEntries(
    SKILLS.map((k) => [k, scale < 1 ? Math.floor((wanted[k] * scale) / 5) * 5 : wanted[k]]),
  ) as Record<Skill, number>;

  const todayMinutes = (await dailyMinutes(userId, today, today))[today];
  const todayMocks = await completeMockDates(userId, today, today);

  const items: TodayItem[] = [];
  for (const skill of SKILLS) {
    if (skill === "speaking") {
      if (mock) {
        items.push({
          id: "speaking-mock",
          skill,
          kind: "mock",
          label: "Speaking mock test",
          minutes: minutes.speaking || 5,
          done: todayMocks.length > 0,
          href: "/ielts/speaking?start=mock",
        });
      } else if (minutes.speaking > 0) {
        items.push({
          id: "speaking-drill",
          skill,
          kind: "drill",
          label: week.focus ? `Speaking drill: ${CRITERION_LABEL[week.focus]}` : "Speaking drill",
          minutes: minutes.speaking,
          done: todayMinutes.speaking >= minutes.speaking,
          href: "/ielts/speaking",
        });
      }
    } else if (minutes[skill] > 0) {
      items.push({
        id: `${skill}-log`,
        skill,
        kind: "log",
        label: `${SKILL_NAME[skill]} practice`,
        minutes: minutes[skill],
        done: todayMinutes[skill] >= minutes[skill],
      });
    }
  }
  return items;
}

export async function logStudy(userId: string, input: { date: string; skill: Skill; minutes: number }): Promise<ActionResult> {
  if (input.skill === "speaking") return fail("Speaking minutes come from your recordings.");
  if (!SKILLS.includes(input.skill)) return fail({ skill: "Pick listening, reading or writing." });
  if (!isRealDate(input.date)) return fail({ date: "Enter the date as YYYY-MM-DD." });
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 480) {
    return fail({ minutes: "Log a whole number of minutes from 1 to 480." });
  }
  await connectDb();
  await IeltsStudyLog.create({ userId, date: input.date, skill: input.skill, minutes: input.minutes });
  return ok();
}
