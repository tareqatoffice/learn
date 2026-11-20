import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "@/components/TopBar";

const pathname = vi.hoisted(() => ({ value: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/app/actions", () => ({ signOutAction: vi.fn() }));

const user = { name: "Tareq Ahmed", isAdmin: false };

beforeEach(() => {
  pathname.value = "/dashboard";
});
afterEach(cleanup);

describe("TopBar", () => {
  it("keeps Admin out of the main links and the menu for non-admins", async () => {
    render(<TopBar user={user} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("puts Admin in the account menu for admins, not the main links", async () => {
    render(<TopBar user={{ ...user, isAdmin: true }} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
  });

  it("links to every area", () => {
    render(<TopBar user={user} />);
    const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");
    expect(href("Dashboard")).toBe("/dashboard");
    expect(href("Interview")).toBe("/interview");
    expect(href("Speaking")).toBe("/speaking");
    expect(href("IELTS")).toBe("/ielts");
    expect(href("Graphs")).toBe("/graphs");
    expect(href("Notes")).toBe("/notes");
    expect(href("Coding")).toBe("/coding");
    expect(href("Learn")).toBe("/dashboard");
  });

  it("marks only the link of the current section as the current page", () => {
    pathname.value = "/graphs/go";
    render(<TopBar user={user} />);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual(["Graphs"]);
  });

  it("does not match a different section that shares a prefix", () => {
    pathname.value = "/notesy";
    render(<TopBar user={user} />);
    expect(screen.getByRole("link", { name: "Notes" }).getAttribute("aria-current")).toBeNull();
  });

  it("offers sign out in the avatar menu", async () => {
    render(<TopBar user={user} />);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("closes the account menu when focus leaves it (U12)", async () => {
    render(<TopBar user={user} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});
