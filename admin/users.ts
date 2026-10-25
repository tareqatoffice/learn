import { isValidObjectId } from "mongoose";
import { z } from "zod";
import type { Result } from "@/admin/service";
import { isAdminEmail } from "@/lib/authz";
import { User } from "@/models";

// Admin review of sign-in requests: approve lets a user in, block keeps (or puts) them out.
// Admins come from ADMIN_EMAILS and can be neither approved nor blocked here.

export const BLOCK_REASON_MAX = 300;

const input = z.object({
  id: z.string().refine((v) => isValidObjectId(v), "Invalid user id"),
  status: z.enum(["approved", "blocked"], { error: "Choose approve or block" }),
  reason: z
    .string()
    .trim()
    .max(BLOCK_REASON_MAX, `Keep the reason under ${BLOCK_REASON_MAX} characters`)
    .optional(),
});

export async function setUserAccess(
  raw: { id: string; status: "approved" | "blocked"; reason?: string },
  adminEmail: string,
): Promise<Result> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: { _: parsed.error.issues[0].message } };
  const { id, status, reason } = parsed.data;

  const user = await User.findById(id, { email: 1 }).lean<{ email: string }>();
  if (!user) return { ok: false, errors: { _: "That user no longer exists." } };
  if (isAdminEmail(user.email)) {
    return { ok: false, errors: { _: "Admins always have access and can't be blocked." } };
  }

  const reviewed = { status, reviewedAt: new Date(), reviewedBy: adminEmail };
  // A block keeps the reason (if any) for the user's blocked screen; approving clears it.
  const blockReason = status === "blocked" && reason ? { blockReason: reason } : null;
  await User.updateOne(
    { _id: id },
    blockReason ? { $set: { ...reviewed, ...blockReason } } : { $set: reviewed, $unset: { blockReason: 1 } },
  );
  return { ok: true, id };
}
