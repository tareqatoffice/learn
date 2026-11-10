import { describe, expect, it, vi } from "vitest";
import { UploadError, uploadTake } from "@/lib/uploadTake";

describe("uploadTake", () => {
  it("PUTs the blob with the given Content-Type", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const blob = new Blob(["abc"], { type: "audio/webm;codecs=opus" });
    await uploadTake("https://r2.example/put", blob, "audio/webm", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith("https://r2.example/put", {
      method: "PUT",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
    });
  });

  it("retries after a failed PUT without re-recording", async () => {
    const blob = new Blob(["abc"]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const f = fetchImpl as unknown as typeof fetch;
    await expect(uploadTake("u", blob, "audio/mp4", f)).rejects.toBeInstanceOf(UploadError);
    await expect(uploadTake("u", blob, "audio/mp4", f)).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].body).toBe(blob);
  });

  it("wraps network failures in UploadError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      uploadTake("u", new Blob(["x"]), "audio/mp4", fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(UploadError);
  });
});
