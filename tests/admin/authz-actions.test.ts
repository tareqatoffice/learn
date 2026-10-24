import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/authz";

vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "64b000000000000000000001", email: "someone@example.test", name: "Someone" } }),
}));

// Every admin Server Action file; the sweep grows as later tasks add actions.
// "(app)" is a glob group, so match the route-group folder with a wildcard.
const modules = import.meta.glob("../../app/*/admin/**/actions.ts", { eager: true }) as Record<string, Record<string, unknown>>;
const actions = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod)
    .filter(([, value]) => typeof value === "function")
    .map(([name, fn]) => ({ label: `${file.replace(/^.*\/admin\//, "")} › ${name}`, fn: fn as (...args: unknown[]) => Promise<unknown> })),
);

describe("admin Server Actions", () => {
  it("are found", () => {
    expect(actions.length).toBeGreaterThan(0);
  });

  it.each(actions.map((a) => [a.label, a.fn] as const))("%s rejects a non-admin", async (_label, fn) => {
    await expect(fn({})).rejects.toBeInstanceOf(ForbiddenError);
  });
});
