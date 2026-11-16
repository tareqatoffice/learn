import { requireAdmin, type SessionUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";

export async function adminContext(): Promise<SessionUser> {
  const user = await requireAdmin();
  await connectDb();
  return user;
}
