import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { visibleNodeFilter } from "@/features/content/visibility";
import { dependentsOf, prereqMessage, unmetPrereqs, type Progress } from "@/features/graph/layout";
import { ForbiddenError } from "@/features/auth/lib/authz";
import { inTransaction, retryOnDuplicateKey } from "@/lib/db";
import { GraphNode, NodeProgress } from "@/models";

export type NodeStatus = "none" | "learning" | "done";

export class PrereqNotDoneError extends Error {
  constructor(titles: string[]) {
    super(prereqMessage(titles));
    this.name = "PrereqNotDoneError";
  }
}

type GraphTopic = { _id: Types.ObjectId; title: string; prereqIds?: Types.ObjectId[] };

async function requirePrereqsDone(
  userId: string,
  topic: { id: string; prereqIds: string[] },
  known: ReadonlySet<string>,
  titles: Map<string, string>,
  session: ClientSession,
): Promise<void> {
  const needed = [...new Set(topic.prereqIds.filter((p) => known.has(p)))];
  if (!needed.length) return;
  const touched = await NodeProgress.updateMany(
    { userId, nodeId: { $in: needed }, status: "done" },
    { $set: { updatedAt: new Date() } },
    { session },
  );
  if (touched.matchedCount >= needed.length) return;
  const rows = await NodeProgress.find({ userId, nodeId: { $in: needed }, status: "done" }, { nodeId: 1 })
    .session(session)
    .lean<{ nodeId: Types.ObjectId }[]>();
  const progress: Progress = Object.fromEntries(rows.map((r) => [String(r.nodeId), "done" as const]));
  const unmet = unmetPrereqs(topic, known, progress);
  throw new PrereqNotDoneError(unmet.map((id) => titles.get(id) ?? id));
}

export async function setNodeStatus(userId: string, nodeId: string, status: NodeStatus): Promise<void> {
  const node = isValidObjectId(nodeId)
    ? await GraphNode.findOne({ ...(await visibleNodeFilter()), _id: nodeId }, { graphId: 1 }).lean<{
        graphId: Types.ObjectId;
      }>()
    : null;
  if (!node) throw new ForbiddenError("Topic not available");

  const topics = await GraphNode.find(await visibleNodeFilter(String(node.graphId)), { title: 1, prereqIds: 1 }).lean<GraphTopic[]>();
  const nodes = topics.map((t) => ({ id: String(t._id), prereqIds: (t.prereqIds ?? []).map(String) }));
  const known = new Set(nodes.map((n) => n.id));
  const titles = new Map(topics.map((t) => [String(t._id), t.title]));
  const topic = nodes.find((n) => n.id === nodeId) ?? { id: nodeId, prereqIds: [] };

  const key = { userId, nodeId };
  const now = new Date();
  const update =
    status === "learning"
      ? { $set: { status }, $unset: { doneAt: 1 } }
      : { $set: { status, doneAt: now } };

  await retryOnDuplicateKey(() =>
    inTransaction(async (session) => {
      if (status !== "none") await requirePrereqsDone(userId, topic, known, titles, session);
      const before = await NodeProgress.findOne(key, { status: 1 }).session(session).lean<{ status: string }>();
      if (status === "none") await NodeProgress.deleteOne(key, { session });
      else
        await NodeProgress.updateOne(
          key,
          { ...update, $setOnInsert: { graphId: node.graphId, startedAt: now } },
          { upsert: true, session },
        );
      if (before?.status === "done" && status !== "done") {
        const dependents = dependentsOf(nodes, nodeId);
        if (dependents.length) await NodeProgress.deleteMany({ userId, nodeId: { $in: dependents } }, { session });
      }
    }),
  );
}

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
    { userId, graphId, nodeId: { $in: ids } },
    { nodeId: 1, status: 1 },
  ).lean<{ nodeId: Types.ObjectId; status: "learning" | "done" }[]>();
  return Object.fromEntries(rows.map((row) => [String(row.nodeId), row.status]));
}
