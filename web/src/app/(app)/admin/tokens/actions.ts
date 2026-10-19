"use server";

import { createToken, revokeToken } from "@/admin/tokens";
import { requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

/** Returns the new token once; only its hash is stored. */
export async function createTokenAction(name: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await requireAdmin();
  const label = typeof name === "string" ? name.trim() : "";
  if (!label) return { ok: false, error: "Give the token a name" };
  await connectDb();
  const { token } = await createToken(label, user.userId);
  return { ok: true, token };
}

export async function revokeTokenAction(id: string): Promise<void> {
  await requireAdmin();
  await connectDb();
  await revokeToken(String(id));
}
