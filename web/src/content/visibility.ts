import type { Model, QueryFilter, Types } from "mongoose";
import { Graph, NoteSeries, QuestionBook } from "@/models";

type Filter = QueryFilter<Record<string, unknown>>;

async function publishedIds(model: Model<unknown>): Promise<Types.ObjectId[]> {
  const rows = await model.find({ status: "published" }, { _id: 1 }).lean<{ _id: Types.ObjectId }[]>();
  return rows.map((row) => row._id);
}

/**
 * Users only see published children of published parents. `restrictTo` narrows
 * the visible parents but never widens past them.
 */
async function visibleChildFilter(
  parentField: string,
  visibleParents: Types.ObjectId[],
  restrictTo?: string[],
): Promise<Filter> {
  const parents = restrictTo
    ? visibleParents.filter((id) => restrictTo.includes(String(id)))
    : visibleParents;
  return { status: "published", [parentField]: { $in: parents } };
}

export const visibleBookIds = () => publishedIds(QuestionBook);
export const visibleGraphIds = () => publishedIds(Graph);
export const visibleSeriesIds = () => publishedIds(NoteSeries);

export async function visibleQuestionFilter(bookIds?: string[]): Promise<Filter> {
  return visibleChildFilter("bookId", await visibleBookIds(), bookIds);
}

export async function visibleNodeFilter(graphId?: string): Promise<Filter> {
  return visibleChildFilter("graphId", await visibleGraphIds(), graphId ? [graphId] : undefined);
}

export async function visibleNoteFilter(seriesId?: string): Promise<Filter> {
  return visibleChildFilter("seriesId", await visibleSeriesIds(), seriesId ? [seriesId] : undefined);
}
