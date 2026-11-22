import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeekStrip, type StripDay } from "@/features/exercise/components/WeekStrip";

afterEach(cleanup);

const days = (over: Record<string, Partial<StripDay>> = {}): StripDay[] =>
  ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"].map((date) => ({
    date,
    done: false,
    ...over[date],
  }));

describe("WeekStrip", () => {
  it("highlights today and links Start to /exercise/workout/<date>", () => {
    render(
      <WeekStrip
        today="2026-11-18"
        days={days({ "2026-11-18": { workout: { focus: "upper", minutes: 30 } } })}
      />,
    );
    const today = screen.getByText("Wed").closest("li")!;
    expect(today.getAttribute("aria-current")).toBe("date");
    const start = within(today).getByRole("link", { name: /start/i });
    expect(start.getAttribute("href")).toBe("/exercise/workout/2026-11-18");
    expect(within(today).getByText(/upper/i)).toBeTruthy();
    expect(within(today).getByText(/30 min/)).toBeTruthy();
    expect(screen.queryByText("Missed")).toBeNull();
  });

  it("marks a past workout without a session as missed", () => {
    render(
      <WeekStrip
        today="2026-11-20"
        days={days({
          "2026-11-16": { workout: { focus: "full", minutes: 30 }, done: true },
          "2026-11-18": { workout: { focus: "lower", minutes: 30 } },
        })}
      />,
    );
    expect(within(screen.getByText("Wed").closest("li")!).getByText("Missed")).toBeTruthy();
    const mon = screen.getByText("Mon").closest("li")!;
    expect(within(mon).getByLabelText("Done")).toBeTruthy();
    expect(within(mon).queryByText("Missed")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
