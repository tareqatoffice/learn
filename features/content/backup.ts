import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose, { type Model } from "mongoose";
import {
  AiConversation,
  AiSettings,
  AppSettings,
  AiUsage,
  CodingResult,
  ExercisePlanWeek,
  Exercise,
  ExerciseProfile,
  FocusSession,
  WeightEntry,
  WorkoutSession,
  ApiToken,
  Graph,
  GraphNode,
  IeltsBandEntry,
  IeltsListeningTest,
  IeltsPlan,
  IeltsPlanSuggestion,
  IeltsProfile,
  IeltsReadingTest,
  IeltsSettings,
  IeltsSpeakingAttempt,
  IeltsSpeakingItem,
  IeltsStudyLog,
  IeltsTestAttempt,
  IeltsWritingAttempt,
  IeltsWritingPrompt,
  NodeProgress,
  Note,
  NoteProgress,
  NoteRecitation,
  NoteSeries,
  Question,
  QuestionBook,
  QuestionProgress,
  QuizSession,
  Revision,
  SpeakingDay,
  SpeakingLesson,
  SpeakingProfile,
  SpeakingSettings,
  SpeakingTake,
  SpeakingUsage,
  SpeakingTakeUsage,
  Subject,
  User,
} from "@/models";

const { EJSON } = mongoose.mongo.BSON;

export const CONTENT_COLLECTIONS: [name: string, model: Model<unknown>][] = [
  ["subjects", Subject],
  ["questionbooks", QuestionBook],
  ["questions", Question],
  ["graphs", Graph],
  ["graphnodes", GraphNode],
  ["noteseries", NoteSeries],
  ["notes", Note],
  ["speakinglessons", SpeakingLesson],
  ["speakingsettings", SpeakingSettings],
  ["ieltsspeakingitems", IeltsSpeakingItem],
  ["ieltssettings", IeltsSettings],
  ["appsettings", AppSettings],
  ["ieltsreadingtests", IeltsReadingTest],
  ["ieltslisteningtests", IeltsListeningTest],
  ["ieltswritingprompts", IeltsWritingPrompt],
  ["exercises", Exercise],
];

const ejson = (value: unknown) => EJSON.stringify(value, { relaxed: false });

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

export const ALL_COLLECTIONS: [name: string, model: Model<unknown>][] = [
  ...CONTENT_COLLECTIONS,
  ["users", User],
  ["questionprogresses", QuestionProgress],
  ["quizsessions", QuizSession],
  ["nodeprogresses", NodeProgress],
  ["noteprogresses", NoteProgress],
  ["noterecitations", NoteRecitation],
  ["revisions", Revision],
  ["apitokens", ApiToken],
  ["aisettings", AiSettings],
  ["speakingtakes", SpeakingTake],
  ["speakingprofiles", SpeakingProfile],
  ["speakingdays", SpeakingDay],
  ["exerciseprofiles", ExerciseProfile],
  ["exerciseplanweeks", ExercisePlanWeek],
  ["workoutsessions", WorkoutSession],
  ["weightentries", WeightEntry],
  ["ieltsprofiles", IeltsProfile],
  ["ieltsplans", IeltsPlan],
  ["ieltsplansuggestions", IeltsPlanSuggestion],
  ["ieltsstudylogs", IeltsStudyLog],
  ["ieltsbandentries", IeltsBandEntry],
  ["ieltsspeakingattempts", IeltsSpeakingAttempt],
  ["ieltstestattempts", IeltsTestAttempt],
  ["ieltswritingattempts", IeltsWritingAttempt],
  ["aiusages", AiUsage],
  ["aiconversations", AiConversation],
  ["speakingusages", SpeakingUsage],
  ["speakingtakeusages", SpeakingTakeUsage],
  ["codingresults", CodingResult],
  ["focussessions", FocusSession],
];

const countsOf = async (collections: typeof ALL_COLLECTIONS) =>
  Object.fromEntries(await Promise.all(collections.map(async ([name, model]) => [name, await model.countDocuments()] as const)));

export async function backupAll(filePath: string): Promise<{ counts: Record<string, number> }> {
  const counts = await countsOf(ALL_COLLECTIONS);
  await pipeline(Readable.from(exportContent(ALL_COLLECTIONS)), createWriteStream(filePath, { encoding: "utf8" }));
  return { counts };
}

export async function restoreAll(filePath: string): Promise<{ counts: Record<string, number> }> {
  for (const [name, model] of ALL_COLLECTIONS) {
    if (await model.exists({})) throw new Error(`target database is not empty (${name} has documents)`);
  }

  const doc = EJSON.parse(await readFile(filePath, "utf8")) as { version?: number; collections?: Record<string, Record<string, unknown>[]> };
  if (doc.version !== 1 || !doc.collections) throw new Error("not a Learn backup or export (version 1)");
  const byName = new Map(ALL_COLLECTIONS);
  const unknown = Object.keys(doc.collections).filter((name) => !byName.has(name));
  if (unknown.length) throw new Error(`unknown collections in backup: ${unknown.join(", ")}`);

  const counts: Record<string, number> = {};
  try {
    for (const [name, docs] of Object.entries(doc.collections)) {
      const model = byName.get(name)!;
      await model.init();
      if (docs.length) await model.collection.insertMany(docs, { ordered: true });
      counts[name] = docs.length;
    }
  } catch (error) {
    await Promise.all(ALL_COLLECTIONS.map(([, model]) => model.collection.deleteMany({})));
    const why = error instanceof Error ? error.message : String(error);
    throw new Error(`restore failed and was rolled back, the database is empty again: ${why}`);
  }
  return { counts };
}
