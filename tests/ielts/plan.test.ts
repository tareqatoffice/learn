import { describe, expect, it } from "vitest";
import { SKILLS } from "@/ielts/bands";
import {
  generatePlan,
  hoursCheck,
  phaseOn,
  studyDaysBetween,
  weekOn,
  type Adjustment,
  type PlanInputs,
  type PlanSettings,
} from "@/ielts/plan";
import { addDays } from "@/speaking/schedule";

const TODAY = "2026-11-11"; // a Wednesday
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SETTINGS: PlanSettings = { hoursPerBand: 200, split: { foundation: 30, skills: 45, mocks: 25 } };

function inputs(overrides: Partial<PlanInputs> = {}): PlanInputs {
  return {
    today: TODAY,
    testDate: addDays(TODAY, 100),
    minutesPerDay: 60,
    studyDays: ALL_DAYS,
    target: { overall: 7 },
    current: { overall: 6 },
    currentUnknown: false,
    ...overrides,
  };
}

function phaseDays(p: { start: string; end: string }): number {
  return studyDaysBetween(p.start, p.end, ALL_DAYS);
}

function weekTotal(w: { minutes: Record<string, number> }): number {
  return SKILLS.reduce((sum, s) => sum + w.minutes[s], 0);
}

describe("studyDaysBetween", () => {
  it("counts inclusive days on the given weekdays, by the date string itself", () => {
    expect(studyDaysBetween("2026-11-11", "2026-11-17", ALL_DAYS)).toBe(7);
    // 2026-11-15 is a Sunday (0), 2026-11-14 a Saturday (6).
    expect(studyDaysBetween("2026-11-11", "2026-11-17", [0, 6])).toBe(2);
    expect(studyDaysBetween("2026-11-15", "2026-11-15", [0])).toBe(1);
    expect(studyDaysBetween("2026-11-12", "2026-11-11", ALL_DAYS)).toBe(0);
  });
});

describe("generatePlan phases", () => {
  it("100 days, all study days, 60 min", () => {
    const plan = generatePlan(inputs(), [], SETTINGS);
    expect(plan.phases.map((p) => p.name)).toEqual(["foundation", "skills", "mocks"]);
    expect(plan.phases.map(phaseDays)).toEqual([30, 45, 25]);
    expect(plan.phases[0].start).toBe(TODAY);
    expect(plan.phases[2].end).toBe(addDays(TODAY, 99));
    expect(plan.phases[1].start).toBe(addDays(plan.phases[0].end, 1));
    expect(plan.phases[2].start).toBe(addDays(plan.phases[1].end, 1));
    expect(plan.hours.available).toBe(100);
    expect(plan.weeks).toHaveLength(15);
    expect(plan.weeks[0].start).toBe(TODAY);
    expect(plan.weeks[14]).toMatchObject({ start: addDays(TODAY, 98), end: addDays(TODAY, 99) });
    expect(weekTotal(plan.weeks[0])).toBe(7 * 60);
    expect(weekTotal(plan.weeks[14])).toBe(2 * 60);
  });

  it("5 days left: one phase, mocks", () => {
    const plan = generatePlan(inputs({ testDate: addDays(TODAY, 5) }), [], SETTINGS);
    expect(plan.phases).toEqual([{ name: "mocks", start: TODAY, end: addDays(TODAY, 4) }]);
  });

  it("20 days left: phases skills then mocks, 12/8 days", () => {
    const plan = generatePlan(inputs({ testDate: addDays(TODAY, 20) }), [], SETTINGS);
    expect(plan.phases.map((p) => p.name)).toEqual(["skills", "mocks"]);
    expect(plan.phases.map(phaseDays)).toEqual([12, 8]);
  });

  it("gives mocks at least the final 7 days", () => {
    const plan = generatePlan(inputs({ testDate: addDays(TODAY, 21) }), [], SETTINGS);
    expect(plan.phases.map(phaseDays)).toEqual([6, 8, 7]);
  });

  it("test date past: throws", () => {
    expect(() => generatePlan(inputs({ testDate: addDays(TODAY, -1) }), [], SETTINGS)).toThrow(
      new RangeError("test date has passed"),
    );
  });

  it("test date today: throws", () => {
    expect(() => generatePlan(inputs({ testDate: TODAY }), [], SETTINGS)).toThrow(
      new RangeError("no days left before the test"),
    );
  });
});

describe("phaseOn / weekOn", () => {
  it("finds the phase and week containing a date", () => {
    const plan = generatePlan(inputs(), [], SETTINGS);
    expect(phaseOn(plan, TODAY)?.name).toBe("foundation");
    expect(phaseOn(plan, addDays(TODAY, 30))?.name).toBe("skills");
    expect(phaseOn(plan, addDays(TODAY, 99))?.name).toBe("mocks");
    expect(phaseOn(plan, addDays(TODAY, 100))).toBeNull();
    expect(weekOn(plan, addDays(TODAY, 8))?.index).toBe(1);
    expect(weekOn(plan, addDays(TODAY, 8))?.week.start).toBe(addDays(TODAY, 7));
    expect(weekOn(plan, addDays(TODAY, -1))).toBeNull();
  });
});

describe("weekly minutes", () => {
  it("per-skill gap weights writing", () => {
    const plan = generatePlan(
      inputs({
        target: { overall: 7, listening: 7, reading: 7, writing: 7, speaking: 7 },
        current: { overall: 6.5, listening: 6.5, reading: 6.5, writing: 5.5, speaking: 6.5 },
      }),
      [],
      SETTINGS,
    );
    for (const w of plan.weeks) {
      expect(w.minutes.writing).toBeGreaterThan(w.minutes.reading);
      const total = weekTotal(w);
      for (const s of SKILLS) expect(w.minutes[s]).toBeGreaterThanOrEqual(Math.ceil(total * 0.15));
    }
  });

  it.each([30, 150])("keeps every skill at 15 %% or more of a small week (%i min)", (perWeek) => {
    // One study day a week (Wednesday, the start day), Speaking already at target.
    const plan = generatePlan(
      inputs({
        minutesPerDay: perWeek,
        studyDays: [3],
        target: { overall: 7, listening: 7, reading: 7, writing: 7, speaking: 7 },
        current: { overall: 5, listening: 5, reading: 5, writing: 5, speaking: 7 },
      }),
      [],
      SETTINGS,
    );
    for (const w of plan.weeks) {
      expect(weekTotal(w)).toBe(perWeek);
      for (const s of SKILLS) expect(w.minutes[s]).toBeGreaterThanOrEqual(Math.ceil(perWeek * 0.15));
      expect(w.minutes.writing).toBeGreaterThan(w.minutes.speaking);
    }
  });

  it("skips the floor when a week is too small for it, keeping the total", () => {
    // Sundays only: the last, 2-day week (Wed..Thu) has no study days, so only spread minutes.
    const adj: Adjustment = { id: "a1", kind: "spreadShortfall", minutes: 3, fromWeek: 14, createdAt: new Date(`${TODAY}T09:00:00Z`) };
    const plan = generatePlan(inputs({ studyDays: [0] }), [adj], SETTINGS);
    const w = plan.weeks[14];
    expect(weekTotal(w)).toBe(3);
    for (const s of SKILLS) expect(w.minutes[s]).toBeGreaterThanOrEqual(0);
  });

  it("raises a small skill share to 15 %", () => {
    const plan = generatePlan(
      inputs({ target: { overall: 9 }, current: { overall: 4, writing: 9, reading: 9, listening: 9 } }),
      [],
      SETTINGS,
    );
    const w = plan.weeks[0];
    expect(weekTotal(w)).toBe(420);
    expect(w.minutes.writing).toBe(63);
    expect(w.minutes.reading).toBe(63);
    expect(w.minutes.listening).toBe(63);
    expect(w.minutes.speaking).toBe(231);
  });

  it("counts only study days", () => {
    // Weekdays only: the first week (Wed..Tue) has 5 study days.
    const plan = generatePlan(inputs({ studyDays: [1, 2, 3, 4, 5] }), [], SETTINGS);
    expect(weekTotal(plan.weeks[0])).toBe(5 * 60);
  });
});

describe("hoursCheck", () => {
  it("hours short", () => {
    const h = hoursCheck(
      inputs({ target: { overall: 7 }, current: { overall: 5 }, testDate: addDays(TODAY, 30) }),
      SETTINGS,
    );
    expect(h).toEqual({ needed: 400, available: 30, short: true });
  });

  it("unknown current assumes target − 1", () => {
    const h = hoursCheck(inputs({ target: { overall: 7 }, current: {}, currentUnknown: true }), SETTINGS);
    expect(h.needed).toBe(200);
  });

  it("needs nothing when current already meets target", () => {
    const h = hoursCheck(inputs({ current: { overall: 7.5 } }), SETTINGS);
    expect(h).toEqual({ needed: 0, available: 100, short: false });
  });
});

describe("mocks per week", () => {
  it("foundation 0 (week 0 = 1 when current unknown), skills 1, mocks 2", () => {
    const known = generatePlan(inputs(), [], SETTINGS);
    const unknown = generatePlan(inputs({ current: {}, currentUnknown: true }), [], SETTINGS);
    for (const plan of [known, unknown]) {
      plan.weeks.forEach((w, i) => {
        const phase = phaseOn(plan, w.start)!.name;
        const expected = phase === "foundation" ? (i === 0 && plan === unknown ? 1 : 0) : phase === "skills" ? 1 : 2;
        expect(w.mocks, `week ${i} (${phase})`).toBe(expected);
      });
    }
    expect(known.weeks[0].mocks).toBe(0);
    expect(unknown.weeks[0].mocks).toBe(1);
  });
});

describe("adjustments", () => {
  const created = new Date("2026-11-11T09:00:00Z");

  it("spreadShortfall adds minutes to remaining weeks", () => {
    const base = generatePlan(inputs(), [], SETTINGS);
    const adj: Adjustment = { id: "a1", kind: "spreadShortfall", minutes: 300, fromWeek: 12, createdAt: created };
    const plan = generatePlan(inputs(), [adj], SETTINGS);
    expect(plan.kept).toEqual([adj]);
    expect(plan.dropped).toEqual([]);
    for (let i = 0; i < 12; i++) expect(plan.weeks[i].minutes).toEqual(base.weeks[i].minutes);
    for (let i = 12; i < 15; i++) {
      expect(weekTotal(plan.weeks[i])).toBe(weekTotal(base.weeks[i]) + 100);
      for (const s of SKILLS) expect(plan.weeks[i].minutes[s]).toBeGreaterThan(base.weeks[i].minutes[s]);
    }
  });

  it("spreadShortfall dropped when fromWeek past end", () => {
    const base = generatePlan(inputs(), [], SETTINGS);
    const adj: Adjustment = { id: "a1", kind: "spreadShortfall", minutes: 300, fromWeek: 15, createdAt: created };
    const plan = generatePlan(inputs(), [adj], SETTINGS);
    expect(plan.kept).toEqual([]);
    expect(plan.dropped).toEqual([adj]);
    expect(plan.weeks).toEqual(base.weeks);
  });

  it("spreadShortfall is one-shot: kept the day it was made, dropped the next day", () => {
    const adj: Adjustment = { id: "a1", kind: "spreadShortfall", minutes: 300, fromWeek: 1, createdAt: created };
    expect(generatePlan(inputs(), [adj], SETTINGS).kept).toEqual([adj]);
    const tomorrow = inputs({ today: addDays(TODAY, 1) });
    const next = generatePlan(tomorrow, [adj], SETTINGS);
    expect(next.kept).toEqual([]);
    expect(next.dropped).toEqual([adj]);
    expect(next.weeks).toEqual(generatePlan(tomorrow, [], SETTINGS).weeks);
  });

  it("shiftCriterion sets focus from its creation week on, without changing minutes", () => {
    const base = generatePlan(inputs(), [], SETTINGS);
    const adj: Adjustment = {
      id: "s1",
      kind: "shiftCriterion",
      criterion: "grammar",
      share: 0.15,
      createdAt: new Date(`${addDays(TODAY, 15)}T09:00:00Z`),
    };
    const plan = generatePlan(inputs(), [adj], SETTINGS);
    expect(plan.kept).toEqual([adj]);
    expect(plan.weeks.map((w) => w.focus)).toEqual([undefined, undefined, ...Array(13).fill("grammar")]);
    expect(plan.weeks.map((w) => w.minutes)).toEqual(base.weeks.map((w) => w.minutes));
  });

  it("the newest shiftCriterion wins on the same day", () => {
    const later: Adjustment = {
      id: "s2",
      kind: "shiftCriterion",
      criterion: "fluency",
      createdAt: new Date("2026-11-11T18:00:00Z"),
    };
    const earlier: Adjustment = { id: "s1", kind: "shiftCriterion", criterion: "grammar", createdAt: created };
    const plan = generatePlan(inputs(), [later, earlier], SETTINGS);
    expect(plan.weeks.every((w) => w.focus === "fluency")).toBe(true);
  });

  it("shiftCriterion dropped when the criterion is met", () => {
    const adj: Adjustment = { id: "s1", kind: "shiftCriterion", criterion: "grammar", share: 0.15, createdAt: created };
    const plan = generatePlan(inputs(), [adj], SETTINGS, { metCriteria: ["grammar"] });
    expect(plan.dropped).toEqual([adj]);
    expect(plan.weeks.every((w) => w.focus === undefined)).toBe(true);
  });
});
