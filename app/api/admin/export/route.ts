import { auth } from "@/auth";
import { exportContent } from "@/content/backup";
import { isAdminEmail } from "@/lib/authz";
import { connectDb } from "@/lib/db";

/** Streams every content collection as one canonical-EJSON download (signed-in admins only; API tokens never apply). */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email))
    return new Response("Forbidden", { status: 403 });
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
