import { describe, expect, it } from "vitest";
import { safeNextPath, signInPath } from "@/features/auth/lib/nextPath";

describe("safeNextPath (F6)", () => {
  it.each(["/dashboard", "/notes/a/b?x=1", "/graphs/js?topic=hooks#t"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each(["https://evil.test/x", "//evil.test", "/\\evil.test", "\\\\evil", "javascript:alert(1)", "dashboard", "/a\nb", "", 42, null])(
    "refuses %s",
    (value) => {
      expect(safeNextPath(value)).toBeNull();
    },
  );

  it("builds the sign-in address with next encoded, or plain / without one", () => {
    expect(signInPath("/notes/a?x=1")).toBe("/?next=%2Fnotes%2Fa%3Fx%3D1");
    expect(signInPath(null)).toBe("/");
    expect(signInPath("/")).toBe("/");
  });
});
