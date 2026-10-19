import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getChapterView, getSeriesView, listSeriesWithProgress } from "@/content/queries";
import { connectDb } from "@/lib/db";
import { GraphNode, Note, NoteSeries } from "@/models";
import { setNoteRead } from "@/progress/notes";
import { resetDb } from "../setup/mongo";
import { newUserId, seedGraph, seedNode } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

async function series(slug: string, status = "published") {
  const s = await NoteSeries.create({ slug, title: `${slug} title`, description: `About ${slug}`, status });
  return String(s._id);
}

async function chapter(seriesId: string, slug: string, order: number, status = "published") {
  const n = await Note.create({
    seriesId,
    slug,
    title: `${slug} title`,
    order,
    body: `## ${slug} heading\n\ntext`,
    toc: [{ depth: 2, text: `${slug} heading`, anchor: `${slug}-heading` }],
    readMinutes: 2,
    status,
  });
  return String(n._id);
}

describe("listSeriesWithProgress", () => {
  it("counts read over visible chapters only", async () => {
    const user = newUserId();
    const s = await series("docker");
    const a = await chapter(s, "a", 0);
    await chapter(s, "b", 1);
    const later = await chapter(s, "c", 2);
    await series("hidden", "draft");
    await setNoteRead(user, a, true);
    await setNoteRead(user, later, true);
    await Note.updateOne({ _id: later }, { status: "archived" });

    expect(await listSeriesWithProgress(user)).toEqual([{ slug: "docker", title: "docker title", read: 1, total: 2 }]);
  });
});

describe("getSeriesView", () => {
  it("lists visible chapters in order with read state", async () => {
    const user = newUserId();
    const s = await series("docker");
    const b = await chapter(s, "b", 1);
    await chapter(s, "a", 0);
    await chapter(s, "draft", 2, "draft");
    await setNoteRead(user, b, true);

    const view = await getSeriesView(user, "docker");
    expect(view?.series).toEqual({ slug: "docker", title: "docker title", description: "About docker" });
    expect(view?.chapters).toEqual([
      { slug: "a", title: "a title", readMinutes: 2, read: false },
      { slug: "b", title: "b title", readMinutes: 2, read: true },
    ]);
  });

  it("returns null for a hidden series", async () => {
    await series("hidden", "draft");
    expect(await getSeriesView(newUserId(), "hidden")).toBeNull();
  });
});

describe("getChapterView", () => {
  it("links prev and next by order, skipping draft chapters", async () => {
    const user = newUserId();
    const s = await series("docker");
    await chapter(s, "one", 0);
    await chapter(s, "draft", 1, "draft");
    await chapter(s, "two", 2);
    await chapter(s, "three", 3);

    const view = await getChapterView(user, "docker", "two");
    expect(view?.chapter).toMatchObject({ slug: "two", title: "two title", readMinutes: 2 });
    expect(view?.prev).toEqual({ slug: "one", title: "one title" });
    expect(view?.next).toEqual({ slug: "three", title: "three title" });
    expect(view?.toc).toEqual([{ depth: 2, text: "two heading", anchor: "two-heading" }]);
    expect(view?.read).toBe(false);

    const first = await getChapterView(user, "docker", "one");
    expect(first?.prev).toBeUndefined();
    expect(first?.next).toEqual({ slug: "two", title: "two title" });
  });

  it("returns null for a draft chapter or a chapter of another series", async () => {
    const s = await series("docker");
    await chapter(s, "draft", 0, "draft");
    const other = await series("oop");
    await chapter(other, "classes", 0);
    expect(await getChapterView(newUserId(), "docker", "draft")).toBeNull();
    expect(await getChapterView(newUserId(), "docker", "classes")).toBeNull();
  });

  it("lists visible topics that link this chapter", async () => {
    const s = await series("docker");
    const note = await chapter(s, "net", 0);
    const g = await seedGraph("backend");
    const linked = await seedNode(g, "networking", { order: 0 });
    const archived = await seedNode(g, "old", { order: 1 });
    await GraphNode.updateMany({ _id: { $in: [linked, archived] } }, { "related.notes": [{ noteId: note, anchor: "" }] });
    await GraphNode.updateOne({ _id: archived }, { status: "archived" });
    const hiddenGraph = await seedGraph("draft-graph", "draft");
    const inHidden = await seedNode(hiddenGraph, "x");
    await GraphNode.updateOne({ _id: inHidden }, { "related.notes": [{ noteId: note, anchor: "" }] });

    const view = await getChapterView(newUserId(), "docker", "net");
    expect(view?.relatedTopics).toEqual([{ graphSlug: "backend", nodeSlug: "networking", title: "networking title" }]);
  });
});
