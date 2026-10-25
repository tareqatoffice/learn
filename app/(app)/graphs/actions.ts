"use server";

import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { setNodeStatus, type NodeStatus } from "@/progress/graph";

const input = z.object({
  nodeId: z.string().regex(/^[0-9a-f]{24}$/i),
  status: z.enum(["none", "learning", "done"]),
});

export async function setNodeStatusAction(
  nodeId: string,
  status: NodeStatus,
): Promise<void> {
  const user = await requireUser();
  const parsed = input.parse({ nodeId, status });
  await connectDb();
  await setNodeStatus(user.userId, parsed.nodeId, parsed.status);
}
