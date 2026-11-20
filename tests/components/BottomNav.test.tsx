import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/BottomNav";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

beforeEach(() => {
  pathname.value = "/dashboard";
});
afterEach(cleanup);

describe("BottomNav", () => {
  it("shows the four primary tabs and a More button", () => {
    render(<BottomNav isAdmin={false} />);
    const bar = screen.getByRole("navigation", { name: "Primary" });
    const names = within(bar)
      .getAllByRole("link")
      .map((a) => a.textContent);
    expect(names).toEqual(["Dashboard", "Interview", "Speaking", "IELTS"]);
    expect(within(bar).getByRole("button", { name: "More" })).toBeTruthy();
  });

  it("marks the current tab", () => {
    pathname.value = "/interview/react";
    render(<BottomNav isAdmin={false} />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Interview"]);
  });

  it("lists the other areas and Profile under More, focuses the sheet and makes the page inert", async () => {
    const main = document.createElement("main");
    main.id = "main";
    document.body.appendChild(main);
    render(<BottomNav isAdmin={false} />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(more);
    const sheet = screen.getByRole("navigation", { name: "More" });
    const hrefs = within(sheet)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/graphs", "/notes", "/coding", "/profile"]);
    expect(document.activeElement?.getAttribute("href")).toBe("/graphs");
    expect(main.inert).toBe(true);
    await userEvent.click(more);
    expect(main.inert).toBe(false);
    expect(screen.queryByRole("navigation", { name: "More" })).toBeNull();
    main.remove();
  });

  it("adds Admin under More for admins only", async () => {
    render(<BottomNav isAdmin />);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(within(screen.getByRole("navigation", { name: "More" })).getByRole("link", { name: "Admin" })).toBeTruthy();
  });

  it("highlights More when the current page lives under it", () => {
    pathname.value = "/notes";
    render(<BottomNav isAdmin={false} />);
    expect(screen.getByRole("button", { name: "More" }).className).toContain("text-foreground");
  });

  it("closes the sheet on Escape and returns focus to More", async () => {
    render(<BottomNav isAdmin={false} />);
    const more = screen.getByRole("button", { name: "More" });
    await userEvent.click(more);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "More" })).toBeNull();
    expect(document.activeElement).toBe(more);
  });
});
