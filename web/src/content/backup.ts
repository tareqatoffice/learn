import mongoose, { type Model } from "mongoose";
import { Graph, GraphNode, Note, NoteSeries, Question, QuestionBook, Subject } from "@/models";

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
