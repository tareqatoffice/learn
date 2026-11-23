import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusStore } from "@/features/focus/lib/store";
import { ReadingMode } from "@/features/notes/components/ReadingMode";

vi.mock("next/navigation", () => ({ usePathname: () => "/notes/docker/networking" }));

const headings = [
  { id: "h-one", text: "One" },
  { id: "h-two", text: "Two" },
];

const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, "scrollY");

function addHeading(id: string, top: number) {
  const el = document.createElement("h2");
  el.id = id;
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

function setPage({ scrollY = 0, scrollable = true }: { scrollY?: number; scrollable?: boolean } = {}) {
  const height = window.innerHeight + (scrollable ? 3000 : 0);
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: height });
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
}

beforeEach(() => {
  useFocusStore.setState({ run: null });
  window.sessionStorage.clear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  document.title = "Docker networking · Learn";
  setPage();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  delete document.documentElement.dataset.reading;
  Reflect.deleteProperty(document.documentElement, "scrollHeight");
  if (scrollYDescriptor) Object.defineProperty(window, "scrollY", scrollYDescriptor);
  else Reflect.deleteProperty(window, "scrollY");
});

describe("ReadingMode", () => {
  it("turns on, marks the page and starts a focus session", async () => {
    const user = userEvent.setup();
    render(<ReadingMode headings={headings} />);
    expect(document.documentElement.dataset.reading).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Focus reading" }));

    expect(document.documentElement.dataset.reading).toBe("on");
    const run = useFocusStore.getState().run;
    expect(run?.context).toMatchObject({ area: "notes", path: "/notes/docker/networking" });
    expect(run?.targetMinutes).toBe(25);
    expect(screen.getByRole("button", { name: "Focus reading" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps a session that is already running", async () => {
    const user = userEvent.setup();
    useFocusStore.getState().start({ area: "coding", label: "Arrays", path: "/coding/arrays" }, 50);
    const id = useFocusStore.getState().run?.id;
    render(<ReadingMode headings={headings} />);

    await user.click(screen.getByRole("button", { name: "Focus reading" }));

    expect(useFocusStore.getState().run?.id).toBe(id);
  });

  it("turns off with the exit button or Escape and clears the page mark", async () => {
    const user = userEvent.setup();
    render(<ReadingMode headings={headings} />);
    await user.click(screen.getByRole("button", { name: "Focus reading" }));
    await user.click(screen.getByRole("button", { name: "Close focus reading" }));
    expect(document.documentElement.dataset.reading).toBeUndefined();
    expect(window.sessionStorage.getItem("learn:reading:v1")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Focus reading" }));

    await user.click(screen.getByRole("button", { name: "Focus reading" }));
    await user.keyboard("{Escape}");
    expect(document.documentElement.dataset.reading).toBeUndefined();
    expect(screen.getByRole("button", { name: "Focus reading" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("stays on across chapters without starting another session", () => {
    window.sessionStorage.setItem("learn:reading:v1", String(Date.now()));
    render(<ReadingMode headings={headings} />);
    expect(document.documentElement.dataset.reading).toBe("on");
    expect(useFocusStore.getState().run).toBeNull();
  });

  it("forgets reading mode after half an hour", () => {
    window.sessionStorage.setItem("learn:reading:v1", String(Date.now() - 31 * 60_000));
    render(<ReadingMode headings={headings} />);
    expect(document.documentElement.dataset.reading).toBeUndefined();
  });

  it("steps between sections", async () => {
    const user = userEvent.setup();
    const one = addHeading("h-one", -50);
    const two = addHeading("h-two", 300);
    render(<ReadingMode headings={headings} />);
    await user.click(screen.getByRole("button", { name: "Focus reading" }));

    expect(screen.getByText("1/2 · One")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next section" }));
    expect(two.scrollIntoView).toHaveBeenCalled();
    expect(one.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Previous section" }).hasAttribute("disabled")).toBe(false);
  });

  it("counts the bottom of the page as the last section", async () => {
    const user = userEvent.setup();
    addHeading("h-one", -300);
    addHeading("h-two", 600);
    setPage({ scrollY: 3000 });
    render(<ReadingMode headings={headings} />);
    await user.click(screen.getByRole("button", { name: "Focus reading" }));
    expect(screen.getByText("2/2 · Two")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next section" }).hasAttribute("disabled")).toBe(true);
  });

  it("disables next at the last section and previous before the first", async () => {
    const user = userEvent.setup();
    addHeading("h-one", -200);
    addHeading("h-two", -50);
    render(<ReadingMode headings={headings} />);
    await user.click(screen.getByRole("button", { name: "Focus reading" }));
    expect(screen.getByRole("button", { name: "Next section" }).hasAttribute("disabled")).toBe(true);

    cleanup();
    document.body.innerHTML = "";
    addHeading("h-one", 400);
    addHeading("h-two", 800);
    render(<ReadingMode headings={headings} />);
    expect(screen.getByRole("button", { name: "Previous section" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Start · 2 sections")).toBeTruthy();
  });

  it("hides the stepper when the page does not scroll", async () => {
    const user = userEvent.setup();
    addHeading("h-one", 100);
    addHeading("h-two", 200);
    setPage({ scrollable: false });
    render(<ReadingMode headings={headings} />);
    await user.click(screen.getByRole("button", { name: "Focus reading" }));
    expect(screen.queryByRole("group", { name: "Sections" })).toBeNull();
    expect(screen.getByRole("button", { name: "Close focus reading" })).toBeTruthy();
  });
});
