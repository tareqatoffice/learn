// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  errorDigest,
  RouteError,
  userFacingErrorMessage,
} from "@/components/RouteError";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("userFacingErrorMessage", () => {
  it("hides the raw message when a digest is present", () => {
    expect(
      userFacingErrorMessage(new Error("secret db host"), "abc123"),
    ).toMatch(/something went wrong/i);
  });

  it("hides the raw message in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(userFacingErrorMessage(new Error("secret db host"))).toMatch(
      /something went wrong/i,
    );
  });

  it("shows the raw message in non-production without a digest", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(userFacingErrorMessage(new Error("detail for debug"))).toBe(
      "detail for debug",
    );
  });
});

describe("errorDigest", () => {
  it("reads digest off an Error", () => {
    const err = Object.assign(new Error("x"), { digest: "d1" });
    expect(errorDigest(err)).toBe("d1");
  });

  it("returns undefined without a digest", () => {
    expect(errorDigest(new Error("x"))).toBeUndefined();
  });
});

describe("RouteError", () => {
  it("shows digest and generic copy, and calls retry", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("leaky internals"), { digest: "ref9" });
    render(<RouteError error={err} retry={retry} />);

    expect(screen.getByText(/something went wrong while loading/i)).toBeTruthy();
    expect(screen.queryByText("leaky internals")).toBeNull();
    expect(screen.getByText(/ref:\s*ref9/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("links to the dashboard by default", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RouteError error={new Error("x")} retry={() => {}} />);
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }).getAttribute("href"),
    ).toBe("/dashboard");
    log.mockRestore();
  });
});
