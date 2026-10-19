import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/env";

const KEYS = [
  "MONGODB_URI",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "ADMIN_EMAILS",
  "AUTH_DEV_LOGIN",
] as const;

describe("getEnv", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    resetEnvCache();
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetEnvCache();
  });

  it("splits ADMIN_EMAILS into trimmed, lower-cased entries", () => {
    process.env.ADMIN_EMAILS = " A@x.com, b@y.com ";
    expect(getEnv().ADMIN_EMAILS).toEqual(["a@x.com", "b@y.com"]);
  });

  it("returns an empty admin list when ADMIN_EMAILS is unset or blank", () => {
    expect(getEnv().ADMIN_EMAILS).toEqual([]);
    resetEnvCache();
    process.env.ADMIN_EMAILS = " , ";
    expect(getEnv().ADMIN_EMAILS).toEqual([]);
  });

  it("throws an error naming MONGODB_URI when it is missing", () => {
    delete process.env.MONGODB_URI;
    expect(() => getEnv()).toThrow(/MONGODB_URI/);
  });

  it("defaults AUTH_DEV_LOGIN to false", () => {
    expect(getEnv().AUTH_DEV_LOGIN).toBe(false);
  });

  it("parses AUTH_DEV_LOGIN=true as true", () => {
    process.env.AUTH_DEV_LOGIN = "true";
    expect(getEnv().AUTH_DEV_LOGIN).toBe(true);
  });

  it("caches the parsed result until resetEnvCache is called", () => {
    const first = getEnv();
    process.env.MONGODB_URI = "mongodb://other:27017/x";
    expect(getEnv()).toBe(first);
    resetEnvCache();
    expect(getEnv().MONGODB_URI).toBe("mongodb://other:27017/x");
  });
});
