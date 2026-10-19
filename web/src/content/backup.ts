import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { finished } from "node:stream/promises";
import mongoose, { type Model } from "mongoose";
import {
  ApiToken,
  Graph,
  GraphNode,
  NodeProgress,
  Note,
  NoteProgress,
  NoteSeries,
  Question,
  QuestionBook,
  QuestionProgress,
  QuizSession,
  Revision,
  Subject,
  User,
} from "@/models";

const { EJSON } = mongoose.mongo.BSON;

/** Content collections in export order (users, progress, revisions and tokens are never part of a content export). */
export const CONTENT_COLLECTIONS: [name: string, model: Model<unknown>][] = [
  ["subjects", Subject],
  ["questionbooks", QuestionBook],
  ["questions", Question],
  ["graphs", Graph],
  ["graphnodes", GraphNode],
  ["noteseries", NoteSeries],
  ["notes", Note],
];

const ejson = (value: unknown) => EJSON.stringify(value, { relaxed: false });

/**
 * Canonical-EJSON document `{ version, exportedAt, collections: { name: [docs] } }`,
 * yielded piece by piece so the whole export never sits in memory at once.
 */
export async function* exportContent(collections = CONTENT_COLLECTIONS): AsyncIterable<string> {
  yield `{"version":1,"exportedAt":${ejson(new Date())},"collections":{`;
  for (const [i, [name, model]] of collections.entries()) {
    yield `${i ? "," : ""}${JSON.stringify(name)}:[`;
    let first = true;
    for await (const doc of model.collection.find({}).sort({ _id: 1 })) {
      yield `${first ? "" : ","}${ejson(doc)}`;
      first = false;
    }
    yield "]";
  }
  yield "}}";
}

/** Everything: content plus users, progress, quiz sessions, revisions and API token hashes. */
export const ALL_COLLECTIONS: [name: string, model: Model<unknown>][] = [
  ...CONTENT_COLLECTIONS,
  ["users", User],
  ["questionprogresses", QuestionProgress],
  ["quizsessions", QuizSession],
  ["nodeprogresses", NodeProgress],
  ["noteprogresses", NoteProgress],
  ["revisions", Revision],
  ["apitokens", ApiToken],
];

const countsOf = async (collections: typeof ALL_COLLECTIONS) =>
  Object.fromEntries(await Promise.all(collections.map(async ([name, model]) => [name, await model.countDocuments()] as const)));

/** Full backup of every collection to `filePath`, in the same format as the content export. */
export async function backupAll(filePath: string): Promise<{ counts: Record<string, number> }> {
  const counts = await countsOf(ALL_COLLECTIONS);
  const out = createWriteStream(filePath, { encoding: "utf8" });
  for await (const chunk of exportContent(ALL_COLLECTIONS)) {
    if (!out.write(chunk)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
  }
  out.end();
  await finished(out);
  return { counts };
}

/**
 * Loads a backup or a content export into an empty database, keeping every original
 * `_id` so progress still points at its content. Refuses when content or users exist.
 */
export async function restoreAll(filePath: string): Promise<{ counts: Record<string, number> }> {
  const guarded = [...CONTENT_COLLECTIONS.map(([, model]) => model), User];
  for (const model of guarded) {
    if (await model.exists({})) throw new Error("target database is not empty");
  }

  const doc = EJSON.parse(await readFile(filePath, "utf8")) as { version?: number; collections?: Record<string, Record<string, unknown>[]> };
  if (doc.version !== 1 || !doc.collections) throw new Error("not a Learn backup or export (version 1)");
  const byName = new Map(ALL_COLLECTIONS);
  const unknown = Object.keys(doc.collections).filter((name) => !byName.has(name));
  if (unknown.length) throw new Error(`unknown collections in backup: ${unknown.join(", ")}`);

  const counts: Record<string, number> = {};
  for (const [name, docs] of Object.entries(doc.collections)) {
    const model = byName.get(name)!;
    await model.init();
    if (docs.length) await model.collection.insertMany(docs, { ordered: true });
    counts[name] = docs.length;
  }
  return { counts };
}
