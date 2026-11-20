import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressTabs, type TrackTab } from "@/features/dashboard/components/ProgressTabs";

const tabs: TrackTab[] = [
  {
    id: "graphs",
    label: "Graphs",
    track: "graphs",
    rows: [
      { key: "a", href: "/graphs/a", label: "Alpha graph", value: 4, max: 4 },
      { key: "b", href: "/graphs/b", label: "Beta graph", value: 1, max: 4 },
    ],
    empty: "No graphs published yet.",
    done: 5,
    total: 8,
  },
  {
    id: "interview",
    label: "Interview",
    track: "interview",
    rows: [{ key: "c", href: "/interview/c", label: "Gamma book", value: 2, max: 5 }],
    empty: "No books published yet.",
    done: 2,
    total: 5,
  },
  { id: "notes", label: "Notes", track: "notes", rows: [], empty: "No notes published yet.", done: 0, total: 0 },
];

afterEach(cleanup);

const selectedTab = () => screen.getByRole("tab", { selected: true });

describe("ProgressTabs", () => {
  it("starts on the first tab and shows its totals in every tab label", () => {
    render(<ProgressTabs tabs={tabs} />);
    expect(selectedTab().textContent).toContain("Graphs");
    expect(screen.getByRole("tab", { name: /Interview/ }).textContent).toContain("2 of 5");
    const rows = within(screen.getByRole("tabpanel")).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual(["/graphs/a", "/graphs/b"]);
  });

  it("switches panel content when another tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ProgressTabs tabs={tabs} />);
    await user.click(screen.getByRole("tab", { name: /Interview/ }));
    expect(selectedTab().textContent).toContain("Interview");
    expect(within(screen.getByRole("tabpanel")).getByRole("link").getAttribute("href")).toBe("/interview/c");
  });

  it("moves selection and focus with the arrow keys, wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<ProgressTabs tabs={tabs} />);
    selectedTab().focus();
    await user.keyboard("{ArrowLeft}");
    expect(selectedTab().textContent).toContain("Notes");
    expect(document.activeElement).toBe(selectedTab());
    await user.keyboard("{ArrowRight}");
    expect(selectedTab().textContent).toContain("Graphs");
    await user.keyboard("{End}");
    expect(selectedTab().textContent).toContain("Notes");
    await user.keyboard("{Home}");
    expect(selectedTab().textContent).toContain("Graphs");
  });

  it("only the selected tab is in the tab order", () => {
    render(<ProgressTabs tabs={tabs} />);
    const tabIndexes = screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"));
    expect(tabIndexes).toEqual(["0", "-1", "-1"]);
  });

  it("hides finished rows on request", async () => {
    const user = userEvent.setup();
    render(<ProgressTabs tabs={tabs} />);
    await user.click(screen.getByRole("checkbox", { name: "Hide finished" }));
    const links = within(screen.getByRole("tabpanel")).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/graphs/b");
  });

  it("says so when every row is finished and hidden", async () => {
    const user = userEvent.setup();
    const done: TrackTab[] = [{ ...tabs[0], rows: [tabs[0].rows[0]], done: 4, total: 4 }];
    render(<ProgressTabs tabs={done} />);
    await user.click(screen.getByRole("checkbox", { name: "Hide finished" }));
    expect(screen.getByRole("status").textContent).toMatch(/all 1 finished/i);
  });

  it("shows the empty message for a tab with no rows", async () => {
    const user = userEvent.setup();
    render(<ProgressTabs tabs={tabs} />);
    await user.click(screen.getByRole("tab", { name: /Notes/ }));
    expect(screen.getByRole("tabpanel").textContent).toBe("No notes published yet.");
  });
});
