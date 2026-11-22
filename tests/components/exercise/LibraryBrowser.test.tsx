import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { LibraryBrowser } from "@/features/exercise/components/LibraryBrowser";
import { EXERCISES } from "@/features/exercise/library";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const names = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("LibraryBrowser", () => {
  it("filters by focus and difficulty", () => {
    render(<LibraryBrowser />);
    fireEvent.click(screen.getByRole("button", { name: "Core" }));
    fireEvent.click(screen.getByRole("button", { name: "Hard" }));
    const expected = EXERCISES.filter((e) => e.focus.includes("core") && e.difficulty === 3).map((e) => e.name);
    expect(expected.length).toBeGreaterThan(0);
    expect(names()).toEqual(expected);
    expect(window.location.search).toBe("?focus=core&difficulty=3");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(names()).toHaveLength(EXERCISES.length);
    expect(window.location.search).toBe("");
  });

  it("search matches name case-insensitively", () => {
    render(<LibraryBrowser />);
    fireEvent.change(screen.getByLabelText("Search exercises"), { target: { value: "PLANK" } });
    const expected = EXERCISES.filter((e) => e.name.toLowerCase().includes("plank")).map((e) => e.name);
    expect(expected).toContain("Plank");
    expect(names()).toEqual(expected);
  });

  it("shows the empty message when nothing matches", () => {
    render(<LibraryBrowser />);
    fireEvent.change(screen.getByLabelText("Search exercises"), { target: { value: "zzzz" } });
    expect(screen.getByText("No exercises match these filters.")).toBeTruthy();
  });
});
