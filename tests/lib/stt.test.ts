import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { SttError, sttConfigured, transcribe } from "@/lib/stt";

describe("stt", () => {
  beforeEach(() => {
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("CF_AI_TOKEN", "tok");
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("sttConfigured needs account id and token", () => {
    expect(sttConfigured()).toBe(true);
    vi.stubEnv("CF_AI_TOKEN", "");
    resetEnvCache();
    expect(sttConfigured()).toBe(false);
  });

  it("transcribe posts base64 audio and returns trimmed text", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true, result: { text: " hello there " } })));
    expect(await transcribe(new Uint8Array([1, 2, 3]), { fetch })).toBe("hello there");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/openai/whisper-large-v3-turbo",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(String(init.body)).audio).toBe("AQID");
  });

  it("transcribe throws SttError on a 500", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(transcribe(new Uint8Array([1]), { fetch })).rejects.toBeInstanceOf(SttError);
  });

  it("transcribe throws SttError when text is missing", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, result: {} })));
    await expect(transcribe(new Uint8Array([1]), { fetch })).rejects.toBeInstanceOf(SttError);
  });
});
