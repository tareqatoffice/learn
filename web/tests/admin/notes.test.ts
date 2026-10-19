import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { saveNote, saveSeries, saveSubject, setNodeNoteLink } from "@/admin/service";
import { connectDb } from "@/lib/db";
import { GraphNode, Note, Subject } from "@/models";
import { resetDb } from "../setup/mongo";
import { seedGraph, seedNode } from "../progress/seed";

beforeAll(connectDb);
beforeEach(resetDb);
afterAll(() => mongoose.disconnect());

const ADMIN = "owner@example.test";

async function series() {
  const r = await saveSeries({ slug: "docker", title: "Docker", description: "", subjects: [], status: "published" }, ADMIN);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

async function note(seriesId: string, body = "## Images\n\ntext\n\n### Layers\n\nmore") {
  const r = await saveNote({ seriesId, slug: "intro", title: "Intro", body, subjects: [], status: "published" }, ADMIN);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.id;
}

describe("saveNote", () => {
  it("computes the table of contents and reading time from the body", async () => {
    const id = await note(await series(), `## Images\n\n${"word ".repeat(401)}\n\n### Layers`);
    const saved = await Note.findById(id).lean<{ toc: { depth: number; text: string; anchor: string }[]; readMinutes: number }>();
    expect(saved?.toc.map(({ depth, text, anchor }) => ({ depth, text, anchor }))).toEqual([
      { depth: 2, text: "Images", anchor: "images" },
      { depth: 3, text: "Layers", anchor: "layers" },
    ]);
    expect(saved?.readMinutes).toBe(3);
  });

  it("recomputes the table of contents on edit", async () => {
    const s = await series();
    const id = await note(s);
    await saveNote({ id, seriesId: s, slug: "intro", title: "Intro", body: "## Volumes", subjects: [], status: "published" }, ADMIN);
    expect((await Note.findById(id).lean<{ toc: { anchor: string }[] }>())?.toc.map((t) => t.anchor)).toEqual(["volumes"]);
  });
});

describe("setNodeNoteLink", () => {
  it("links a heading that exists and rejects one that does not", async () => {
    const n = await note(await series());
    const node = await seedNode(await seedGraph("g"), "images");

    expect(await setNodeNoteLink(node, n, "nope", true, ADMIN)).toMatchObject({ ok: false, errors: { anchor: expect.any(String) } });
    expect(await setNodeNoteLink(node, n, "layers", true, ADMIN)).toEqual({ ok: true, id: node });
    expect(await setNodeNoteLink(node, n, "", true, ADMIN)).toEqual({ ok: true, id: node });
    const links = async () =>
      ((await GraphNode.findById(node).lean<{ related: { notes: { noteId: unknown; anchor: string }[] } }>())?.related.notes ?? []).map(
        (l) => `${String(l.noteId)}#${l.anchor}`,
      );
    expect(await links()).toEqual([`${n}#layers`, `${n}#`]);

    await setNodeNoteLink(node, n, "layers", false, ADMIN);
    expect(await links()).toEqual([`${n}#`]);
  });
});

describe("saveSubject", () => {
  it("creates and renames a subject", async () => {
    const r = await saveSubject({ slug: "react", name: "React" }, ADMIN);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(await saveSubject({ id: r.id, slug: "react", name: "React.js" }, ADMIN)).toEqual({ ok: true, id: r.id });
    expect((await Subject.findById(r.id).lean<{ name: string }>())?.name).toBe("React.js");
    expect(await saveSubject({ slug: "react", name: "Dupe" }, ADMIN)).toMatchObject({ ok: false, errors: { slug: expect.any(String) } });
  });
});
