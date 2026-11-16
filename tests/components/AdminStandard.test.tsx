import { existsSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh, confirmMock } = vi.hoisted(() => ({
  refresh: vi.fn(),
  confirmMock: vi.fn(async () => true),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/components/ConfirmDialog", () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
  ConfirmHost: () => null,
}));

import { ADMIN_NAV } from "@/admin/nav";
import { fail, firstError, ok } from "@/admin/result";
import { AdminList, AdminListItem, AdminPage } from "@/components/admin/layout";
import { ActionStatus } from "@/components/admin/SaveBar";
import { useAdminAction } from "@/components/admin/useAdminAction";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  confirmMock.mockResolvedValue(true);
});

describe("ActionResult helpers", () => {
  it("builds results and picks the whole-form message first", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, id: "1" });
    expect(fail("Nope")).toEqual({ ok: false, errors: { _: "Nope" } });
    expect(firstError({ name: "Required", _: "Whole form" })).toBe("Whole form");
    expect(firstError({ name: "Required" })).toBe("Required");
    expect(firstError({})).toBeUndefined();
  });
});

describe("useAdminAction", () => {
  it("tracks pending, marks saved and refreshes on success", async () => {
    const { result } = renderHook(() => useAdminAction());
    const onSuccess = vi.fn();
    await act(async () => result.current.run(async () => ok({ id: "x" }), { onSuccess }));
    expect(result.current.saved).toBe(true);
    expect(result.current.errors).toEqual({});
    expect(onSuccess).toHaveBeenCalledWith({ ok: true, id: "x" });
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => result.current.touch());
    expect(result.current.saved).toBe(false);
  });

  it("keeps errors and does not refresh on failure or a thrown error", async () => {
    const { result } = renderHook(() => useAdminAction());
    await act(async () => result.current.run(async () => fail({ name: "Required" })));
    expect(result.current.errors).toEqual({ name: "Required" });
    await act(async () =>
      result.current.run(async () => {
        throw new Error("network");
      }),
    );
    expect(result.current.errors).toEqual({ _: "Something went wrong. Try again." });
    expect(result.current.saved).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does nothing when the confirm prompt is declined, and can skip the refresh", async () => {
    confirmMock.mockResolvedValueOnce(false);
    const action = vi.fn(async () => ok());
    const { result } = renderHook(() => useAdminAction());
    await act(async () => result.current.run(action, { confirm: "Sure?" }));
    expect(action).not.toHaveBeenCalled();
    await act(async () => result.current.run(action, { refresh: false }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("ActionStatus", () => {
  it("shows the whole-form error, else a labelled field error, else the saved text", () => {
    const { rerender } = render(<ActionStatus saved errors={{ fallbackModel: "Pick another", _: "Failed" }} />);
    expect(screen.getByRole("alert").textContent).toBe("Failed");
    rerender(<ActionStatus saved errors={{ fallbackModel: "Pick another" }} />);
    expect(screen.getByRole("alert").textContent).toBe("Fallback model: Pick another");
    rerender(<ActionStatus saved errors={{}} savedText="Restored." />);
    expect(screen.getByRole("status").textContent).toBe("Restored.");
    rerender(<ActionStatus saved={false} errors={{}} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("admin layout", () => {
  it("renders the header with back link, actions and description", () => {
    render(
      <AdminPage title="Books" back={{ href: "/admin", label: "Admin" }} actions={<button>New</button>} description="All books.">
        <p>body</p>
      </AdminPage>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Books");
    expect(screen.getByRole("link", { name: "← Admin" }).getAttribute("href")).toBe("/admin");
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy();
    expect(screen.getByText("All books.")).toBeTruthy();
  });

  it("shows the empty state instead of an empty list", () => {
    const { rerender } = render(<AdminList empty="No books yet.">{[]}</AdminList>);
    expect(screen.getByText("No books yet.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    rerender(
      <AdminList empty="No books yet.">
        {[<AdminListItem key="a">A</AdminListItem>]}
      </AdminList>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("admin structure", () => {
  it("has a page for every section in the admin navigation", () => {
    const missing = ADMIN_NAV.flatMap((g) => g.links)
      .map((l) => l.href)
      .filter((href) => !existsSync(path.join(process.cwd(), "app/(app)", href, "page.tsx")));
    expect(missing).toEqual([]);
  });
});
