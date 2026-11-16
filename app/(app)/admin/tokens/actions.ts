"use server";

import { adminContext } from "@/admin/action";
import { type ActionResult, fail, ok } from "@/admin/result";
import { TOKEN_LIFETIMES, type TokenLifetime, createToken, revokeToken } from "@/admin/tokens";
import { TOKEN_SCOPES, type TokenScope } from "@/models";

export async function createTokenAction(
  name: string,
  options: { scope?: TokenScope; lifetimeDays?: TokenLifetime } = {},
): Promise<ActionResult<{ token: string }>> {
  const user = await adminContext();
  const label = typeof name === "string" ? name.trim() : "";
  if (!label) return fail({ name: "Give the token a name" });
  const scope = options?.scope ?? "write";
  if (!TOKEN_SCOPES.includes(scope)) return fail({ scope: "Choose read only or read and import" });
  const lifetimeDays = options?.lifetimeDays ?? null;
  if (!TOKEN_LIFETIMES.includes(lifetimeDays)) return fail({ lifetimeDays: "Choose when the token expires" });
  const { token } = await createToken(label, user.userId, { scope, lifetimeDays });
  return ok({ token });
}

export async function revokeTokenAction(id: string): Promise<ActionResult> {
  await adminContext();
  if (!(await revokeToken(String(id)))) return fail("That token was already revoked or no longer exists.");
  return ok();
}
