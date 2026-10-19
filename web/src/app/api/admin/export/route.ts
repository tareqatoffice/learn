import { exportContent } from "@/content/backup";
import { ForbiddenError, requireAdmin } from "@/lib/authz";
import { connectDb } from "@/lib/db";

/** Streams every content collection as one canonical-EJSON download (admins only). */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw error;
  }
  await connectDb();

  const encoder = new TextEncoder();
  const iterator = exportContent()[Symbol.asyncIterator]();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="learn-content-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
