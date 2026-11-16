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
  it("hides the Admin link for non-admins", () => {
    render(<TopBar user={user} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("shows the Admin link for admins", () => {
    render(<TopBar user={{ ...user, isAdmin: true }} />);
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

  it("lists Profile in the mobile menu, focuses it and makes the page inert while open (U3, U12)", async () => {
    const main = document.createElement("main");
    main.id = "main";
    document.body.appendChild(main);
    render(<TopBar user={user} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(nav.querySelector('a[href="/profile"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute("href")).toBe("/dashboard");
    expect(main.inert).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(main.inert).toBe(false);
    main.remove();
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

  it("collapses the links into a menu button on small screens", async () => {
    render(<TopBar user={user} />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("link", { name: "Notes" })).toHaveLength(2);
  });
});
