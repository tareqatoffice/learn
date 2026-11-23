import { PHOTO_CONTENT_TYPE, PHOTO_KEY } from "@/features/exercise/catalog";
import { getObjectBytes, storageConfigured } from "@/lib/r2";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!PHOTO_KEY.test(key) || !storageConfigured()) return new Response("Not found", { status: 404 });
  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": PHOTO_CONTENT_TYPE[key.slice(key.lastIndexOf(".") + 1)] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
