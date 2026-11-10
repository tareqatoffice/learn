// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WeekStrip } from "@/components/speaking/WeekStrip";

afterEach(cleanup);

const week = [
  { date: "2026-11-08", fraction: 1 },
  { date: "2026-11-09", fraction: 0.5 },
  { date: "2026-11-10", fraction: 0.25 },
  { date: "2026-11-11", fraction: 0 },
  { date: "2026-11-12", fraction: 0 },
  { date: "2026-11-13", fraction: 0 },
  { date: "2026-11-14", fraction: 0 },
];

describe("WeekStrip", () => {
  it("WeekStrip outlines today and scales bars by fraction", () => {
    render(<WeekStrip week={week} today="2026-11-10" />);
    const days = screen.getAllByRole("listitem");
    expect(days).toHaveLength(7);

    const today = days.find((d) => d.getAttribute("aria-current") === "date");
    expect(today?.dataset.date).toBe("2026-11-10");
    expect(days.filter((d) => d.getAttribute("aria-current"))).toHaveLength(1);
    expect(today?.querySelector("[data-bar]")?.className).toMatch(/outline/);

    const height = (i: number) => (days[i].querySelector("[data-fill]") as HTMLElement).style.height;
    expect(height(0)).toBe("100%");
    expect(height(1)).toBe("50%");
    expect(height(2)).toBe("25%");
    expect(height(3)).toBe("0%");
  });

  it("caps a bar at 100% and names each day's share", () => {
    render(<WeekStrip week={week.map((d, i) => (i === 0 ? { ...d, fraction: 1.7 } : d))} today="2026-11-10" />);
    const first = screen.getAllByRole("listitem")[0];
    expect((first.querySelector("[data-fill]") as HTMLElement).style.height).toBe("100%");
    expect(first.textContent).toMatch(/Sun/);
    expect(screen.getByText(/100% of target/)).toBeTruthy();
  });
});
