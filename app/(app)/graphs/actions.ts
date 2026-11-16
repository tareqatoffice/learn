"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { PrereqNotDoneError, setNodeStatus, type NodeStatus } from "@/progress/graph";

const input = z.object({
  nodeId: z.string().regex(/^[0-9a-f]{24}$/i),
  status: z.enum(["none", "learning", "done"]),
});

export async function setNodeStatusAction(
  nodeId: string,
  status: NodeStatus,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = input.parse({ nodeId, status });
  await connectDb();
  try {
    await setNodeStatus(user.userId, parsed.nodeId, parsed.status);
  } catch (e) {
    if (e instanceof PrereqNotDoneError) return { error: e.message };
    throw e;
  }
  refresh();
  return {};
}
