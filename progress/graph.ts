import { isValidObjectId, type Types } from "mongoose";
import { visibleNodeFilter } from "@/content/visibility";
import { ForbiddenError } from "@/lib/authz";
import { retryOnDuplicateKey } from "@/lib/db";
import { GraphNode, NodeProgress } from "@/models";

export type NodeStatus = "none" | "learning" | "done";

/** Sets a topic's status for the user; `none` removes the progress doc. The node must be visible. */
export async function setNodeStatus(userId: string, nodeId: string, status: NodeStatus): Promise<void> {
  const node = isValidObjectId(nodeId)
    ? await GraphNode.findOne({ ...(await visibleNodeFilter()), _id: nodeId }, { graphId: 1 }).lean<{
        graphId: Types.ObjectId;
      }>()
    : null;
  if (!node) throw new ForbiddenError("Topic not available");

  const key = { userId, nodeId };
  if (status === "none") {
    await NodeProgress.deleteOne(key);
    return;
  }
  const now = new Date();
  const update =
    status === "learning"
      ? { $set: { status }, $unset: { doneAt: 1 } }
      : { $set: { status, doneAt: now } };
  await retryOnDuplicateKey(() =>
    NodeProgress.updateOne(key, { ...update, $setOnInsert: { graphId: node.graphId, startedAt: now } }, { upsert: true }),
  );
}

/**
 * Status per visible node of the graph that the user has started (nodeId -> status). A caller that
 * already holds the graph's visible node ids passes them as `visibleIds` to skip reading them again.
 */
export async function getGraphProgress(
  userId: string,
  graphId: string,
  visibleIds?: Types.ObjectId[],
): Promise<Record<string, "learning" | "done">> {
  if (!isValidObjectId(graphId)) return {};
  const ids =
    visibleIds ??
    (await GraphNode.find(await visibleNodeFilter(graphId), { _id: 1 }).lean<{ _id: Types.ObjectId }[]>()).map((n) => n._id);
  const rows = await NodeProgress.find(
    { userId, nodeId: { $in: ids } },
    { nodeId: 1, status: 1 },
  ).lean<{ nodeId: Types.ObjectId; status: "learning" | "done" }[]>();
  return Object.fromEntries(rows.map((row) => [String(row.nodeId), row.status]));
}
