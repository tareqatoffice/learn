import type { Types } from "mongoose";
import { withToken } from "@/features/auth/lib/tokenAuth";
import { Graph, NoteSeries, QuestionBook } from "@/models";

type Row = { _id: Types.ObjectId; slug: string; title: string; status: string };
const rows = (model: typeof Graph) =>
  model
    .find({}, { slug: 1, title: 1, status: 1 })
    .sort({ order: 1, _id: 1 })
    .lean<Row[]>()
    .then((list) =>
      list.map((r) => ({
        id: String(r._id),
        slug: r.slug,
        title: r.title,
        status: r.status,
      })),
    );

export function GET(req: Request): Promise<Response> {
  return withToken(req, async () => {
    const [books, series, graphs] = await Promise.all([rows(QuestionBook), rows(NoteSeries), rows(Graph)]);
    return Response.json({ books, series, graphs });
  });
}
