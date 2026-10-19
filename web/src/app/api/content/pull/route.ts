import { NotFoundError, pullBook, pullGraph, pullSeries } from "@/content/pull";
import { withToken } from "@/lib/tokenAuth";

/** GET ?kind=book|series|graph&slug=… — the item in its canonical, re-importable format. */
export function GET(req: Request): Promise<Response> {
  return withToken(req, async () => {
    const params = new URL(req.url).searchParams;
    const kind = params.get("kind");
    const slug = params.get("slug") ?? "";
    if (!/^[a-z0-9-]+$/.test(slug)) return Response.json({ error: "slug is required" }, { status: 400 });
    try {
      if (kind === "book") return Response.json(await pullBook(slug));
      if (kind === "series") return Response.json(await pullSeries(slug));
      if (kind === "graph") return Response.json(await pullGraph(slug));
    } catch (error) {
      if (error instanceof NotFoundError) return Response.json({ error: error.message }, { status: 404 });
      throw error;
    }
    return Response.json({ error: "kind must be book, series or graph" }, { status: 400 });
  });
}
