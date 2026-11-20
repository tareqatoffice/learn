import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/features/ai/lib/secrets";

describe("secrets", () => {
  it("round-trips, with a fresh IV each time", () => {
    const a = encryptSecret("sk-or-v1-abc", "s1", "p");
    const b = encryptSecret("sk-or-v1-abc", "s1", "p");
    expect(a).not.toBe(b);
    expect(a).not.toContain("sk-or");
    expect(decryptSecret(a, "s1", "p")).toBe("sk-or-v1-abc");
  });

  it("returns null for another secret, another purpose, tampering or junk", () => {
    const sealed = encryptSecret("value", "s1", "p");
    expect(decryptSecret(sealed, "s2", "p")).toBeNull();
    expect(decryptSecret(sealed, "s1", "other")).toBeNull();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decryptSecret(parts.join("."), "s1", "p")).toBeNull();
    expect(decryptSecret("junk", "s1", "p")).toBeNull();
    expect(decryptSecret(sealed, "", "p")).toBeNull();
  });

  it("refuses to encrypt without a secret", () => {
    expect(() => encryptSecret("x", "", "p")).toThrow(/AUTH_SECRET/);
  });
});
