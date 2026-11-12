import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({
  auth: () =>
    Promise.resolve(session.userId ? { user: { id: session.userId, email: "learner@example.test", name: "Learner" } } : null),
}));

import { setNodeStatusAction } from "@/app/(app)/graphs/actions";
import { ForbiddenError } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { GraphNode, NodeProgress } from "@/models";
import { getGraphProgress, PrereqNotDoneError, setNodeStatus } from "@/progress/graph";
import { resetDb } from "../setup/mongo";
import { newUserId, seedGraph, seedNode } from "./seed";

type Row = { status: string; startedAt?: Date; doneAt?: Date; graphId: unknown };

describe("graph progress", () => {
  beforeAll(async () => {
    await connectDb();
  });
  beforeEach(resetDb);
  afterEach(() => vi.useRealTimers());
  afterAll(() => mongoose.disconnect());

  it("survives two racing first status changes (duplicate key retried)", async () => {
    const user = newUserId();
    const node = await seedNode(await seedGraph("g"), "n");
    await NodeProgress.init();
    await Promise.all(Array.from({ length: 8 }, () => setNodeStatus(user, node, "learning")));
    expect(await NodeProgress.countDocuments({ userId: user })).toBe(1);
  });

  it("none -> learning -> done -> none leaves no doc and keeps startedAt", async () => {
    const user = newUserId();
    const graphId = await seedGraph("g");
    const node = await seedNode(graphId, "n");
    vi.useFakeTimers({ toFake: ["Date"] });

    await setNodeStatus(user, node, "none");
    expect(await NodeProgress.countDocuments()).toBe(0);

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await setNodeStatus(user, node, "learning");
    const learning = await NodeProgress.findOne({ userId: user, nodeId: node }).lean<Row>();
    expect(learning).toMatchObject({ status: "learning", startedAt: new Date("2026-01-01T00:00:00Z") });
    expect(String(learning!.graphId)).toBe(graphId);
    expect(learning!.doneAt).toBeUndefined();

    vi.setSystemTime(new Date("2026-01-05T00:00:00Z"));
    await setNodeStatus(user, node, "done");
    const done = await NodeProgress.findOne({ userId: user, nodeId: node }).lean<Row>();
    expect(done).toMatchObject({
      status: "done",
      startedAt: new Date("2026-01-01T00:00:00Z"),
      doneAt: new Date("2026-01-05T00:00:00Z"),
    });

    await setNodeStatus(user, node, "none");
    expect(await NodeProgress.countDocuments()).toBe(0);
  });

  it("done straight from none sets startedAt; learning after done unsets doneAt", async () => {
    const user = newUserId();
    const node = await seedNode(await seedGraph("g"), "n");

    await setNodeStatus(user, node, "done");
    const done = await NodeProgress.findOne({ userId: user, nodeId: node }).lean<Row>();
    expect(done!.startedAt).toBeInstanceOf(Date);
    expect(done!.doneAt).toBeInstanceOf(Date);

    await setNodeStatus(user, node, "learning");
    const back = await NodeProgress.findOne({ userId: user, nodeId: node }).lean<Row>();
    expect(back!.status).toBe("learning");
    expect(back!.doneAt).toBeUndefined();
    expect(back!.startedAt).toEqual(done!.startedAt);
    expect(await NodeProgress.countDocuments()).toBe(1);
  });

  it("rejects nodes that are not visible", async () => {
    const user = newUserId();
    const graphId = await seedGraph("g");
    const draftNode = await seedNode(graphId, "draft", { status: "draft" });
    const inDraftGraph = await seedNode(await seedGraph("hidden", "draft"), "n");

    await expect(setNodeStatus(user, draftNode, "learning")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setNodeStatus(user, inDraftGraph, "done")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setNodeStatus(user, String(new mongoose.Types.ObjectId()), "none")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(setNodeStatus(user, "not-an-id", "learning")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await NodeProgress.countDocuments()).toBe(0);
  });

  it("blocks learning/done until every visible prerequisite is done", async () => {
    const user = newUserId();
    const graphId = await seedGraph("g");
    const a = await seedNode(graphId, "a");
    const hidden = await seedNode(graphId, "hidden", { status: "draft" });
    const b = await seedNode(graphId, "b", { prereqIds: [a, hidden] });

    await expect(setNodeStatus(user, b, "done")).rejects.toBeInstanceOf(PrereqNotDoneError);
    await expect(setNodeStatus(user, b, "learning")).rejects.toBeInstanceOf(PrereqNotDoneError);
    await setNodeStatus(user, a, "learning");
    await expect(setNodeStatus(user, b, "done")).rejects.toBeInstanceOf(PrereqNotDoneError);
    expect(await NodeProgress.countDocuments({ userId: user, nodeId: b })).toBe(0);

    await setNodeStatus(user, a, "done");
    await setNodeStatus(user, b, "done");
    expect(await NodeProgress.countDocuments({ userId: user, nodeId: b, status: "done" })).toBe(1);
    // Clearing is always allowed.
    await setNodeStatus(user, a, "none");
    await setNodeStatus(user, b, "none");
  });

  it("taking a done topic back clears the progress of its dependents only", async () => {
    const user = newUserId();
    const graphId = await seedGraph("g");
    const a = await seedNode(graphId, "a");
    const b = await seedNode(graphId, "b", { prereqIds: [a] });
    const c = await seedNode(graphId, "c", { prereqIds: [b] });
    const other = await seedNode(graphId, "other");
    for (const id of [a, b, other]) await setNodeStatus(user, id, "done");
    await setNodeStatus(user, c, "learning");

    await setNodeStatus(user, a, "learning");
    expect(await getGraphProgress(user, graphId)).toEqual({ [a]: "learning", [other]: "done" });

    // Not touching a done topic's own state leaves dependents alone.
    await setNodeStatus(user, a, "done");
    await setNodeStatus(user, b, "done");
    await setNodeStatus(user, a, "done");
    expect(await getGraphProgress(user, graphId)).toEqual({ [a]: "done", [b]: "done", [other]: "done" });
  });

  it("ignores a prerequisite that belongs to another graph", async () => {
    const user = newUserId();
    const elsewhere = await seedNode(await seedGraph("g2"), "x");
    const b = await seedNode(await seedGraph("g"), "b", { prereqIds: [elsewhere] });
    await setNodeStatus(user, b, "done");
    expect(await NodeProgress.countDocuments({ userId: user, nodeId: b })).toBe(1);
  });

  it("the action returns the refusal instead of throwing", async () => {
    const user = newUserId();
    session.userId = user;
    const graphId = await seedGraph("g");
    const a = await seedNode(graphId, "a");
    const b = await seedNode(graphId, "b", { prereqIds: [a] });

    expect(await setNodeStatusAction(b, "done")).toEqual({ error: "Finish first: a title" });
    expect(await setNodeStatusAction(a, "done")).toEqual({});
    expect(await setNodeStatusAction(b, "done")).toEqual({});
  });

  it("getGraphProgress maps visible nodes of the graph to their status, per user", async () => {
    const user = newUserId();
    const other = newUserId();
    const graphId = await seedGraph("g");
    const a = await seedNode(graphId, "a");
    const b = await seedNode(graphId, "b");
    const c = await seedNode(graphId, "c");
    const elsewhere = await seedNode(await seedGraph("g2"), "x");
    await setNodeStatus(user, a, "learning");
    await setNodeStatus(user, b, "done");
    await setNodeStatus(user, c, "done");
    await setNodeStatus(user, elsewhere, "done");
    await setNodeStatus(other, a, "done");
    await GraphNode.updateOne({ _id: c }, { status: "archived" });

    expect(await getGraphProgress(user, graphId)).toEqual({ [a]: "learning", [b]: "done" });
    expect(await getGraphProgress(other, graphId)).toEqual({ [a]: "done" });
  });
});
