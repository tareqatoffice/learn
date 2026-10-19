import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/authz";
import { connectDb } from "@/lib/db";
import { GraphNode, NodeProgress } from "@/models";
import { getGraphProgress, setNodeStatus } from "@/progress/graph";
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
