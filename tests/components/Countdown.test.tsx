// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Countdown } from "@/components/ielts/Countdown";

afterEach(cleanup);

describe("Countdown", () => {
  it("counts the days to the test", () => {
    render(<Countdown today="2026-11-10" testDate="2026-11-12" phase={null} week={null} />);
    expect(screen.getByText(/2 days/)).toBeTruthy();
    expect(screen.queryByText("Your test is today")).toBeNull();
  });

  it("shows test-day copy on the day itself", () => {
    render(<Countdown today="2026-11-12" testDate="2026-11-12" phase="mocks" week={{ index: 3, count: 4 }} />);
    expect(screen.getByText("Your test is today")).toBeTruthy();
    expect(screen.getByText(/good luck/i)).toBeTruthy();
    expect(screen.queryByText(/0 days/)).toBeNull();
  });
});
