import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusReminder } from "@/features/focus/components/FocusReminder";
import { useFocusStore } from "@/features/focus/lib/store";

const { toast, push } = vi.hoisted(() => ({ toast: vi.fn(), push: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const plan = { time: "19:00", action: "read chapter 2", minutes: 25, enabled: true };
const at = (h: number, m: number) => vi.setSystemTime(new Date(2026, 10, 24, h, m));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  window.localStorage.clear();
  useFocusStore.setState({ run: null });
  toast.mockClear();
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FocusReminder", () => {
  it("reminds once at the planned time and links to the plan", () => {
    at(19, 5);
    const { unmount } = render(<FocusReminder plan={plan} />);
    expect(toast).toHaveBeenCalledTimes(1);
    const [title, options] = toast.mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    expect(title).toBe("Time to focus: read chapter 2");
    expect(options.description).toMatch(/25 minutes/);

    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/focus/review");

    unmount();
    render(<FocusReminder plan={plan} />);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("stays quiet before the time, after the window, or with the plan off", () => {
    at(18, 50);
    render(<FocusReminder plan={plan} />);
    cleanup();
    at(19, 30);
    render(<FocusReminder plan={plan} />);
    cleanup();
    at(19, 5);
    render(<FocusReminder plan={{ ...plan, enabled: false }} />);
    cleanup();
    render(<FocusReminder plan={null} />);
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not interrupt a session that is already running", () => {
    useFocusStore.getState().start({ area: "notes", label: "Channels", path: "/notes/go/channels" }, 25);
    at(19, 5);
    render(<FocusReminder plan={plan} />);
    expect(toast).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("learn:focus:reminded")).toBe("2026-11-24");
  });
});
