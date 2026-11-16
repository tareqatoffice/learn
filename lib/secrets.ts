import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";


const VERSION = "v1";

function keyFor(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "learn", purpose, 32));
}

export function encryptSecret(plain: string, secret: string, purpose: string): string {
  if (!secret) throw new Error("AUTH_SECRET is required to store secrets");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret, purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(sealed: string, secret: string, purpose: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined || !secret) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFor(secret, purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
