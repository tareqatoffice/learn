import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import {
  AiError,
  OPENROUTER_URL,
  chatCompletion,
  checkModels,
  extractJson,
  listCatalog,
  verifyKey,
  parseCatalog,
  resetCatalogCache,
} from "@/lib/openrouter";

const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
const sentModel = (fetch: ReturnType<typeof vi.fn>, call: number) =>
  JSON.parse(String((fetch.mock.calls[call] as unknown as [string, RequestInit])[1].body)).model;
const msg = [{ role: "user" as const, content: "hi" }];

describe("openrouter", () => {
  beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    resetEnvCache();
    resetCatalogCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetEnvCache();
  });

  it("posts the messages with the key and returns the reply text and model", async () => {
    const fetch = vi.fn(async () => reply("  hello  "));
    const result = await chatCompletion(msg, {
      apiKey: "sk-test", models: ["a/one:free"],
      fetch,
      jsonSchema: { name: "x", schema: { type: "object" } },
    });
    expect(result).toEqual({ text: "hello", model: "a/one:free" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("a/one:free");
    expect(body.messages).toEqual(msg);
    expect(body.response_format.json_schema.name).toBe("x");
  });

  it("falls back to the next model on errors, empty and unaccepted replies", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(reply(""))
      .mockResolvedValueOnce(reply("not json"))
      .mockResolvedValueOnce(reply('{"ok":true}'));
    const result = await chatCompletion(msg, {
      apiKey: "sk-test", models: ["a/1", "a/2", "a/3", "a/4"],
      fetch,
      accept: (t) => t.startsWith("{"),
    });
    expect(result).toEqual({ text: '{"ok":true}', model: "a/4" });
    expect([0, 1, 2, 3].map((i) => sentModel(fetch, i))).toEqual(["a/1", "a/2", "a/3", "a/4"]);
  });

  it("reports the last failure when every model fails", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    await expect(chatCompletion(msg, { apiKey: "sk-test", models: ["a/1", "a/2"], fetch })).rejects.toThrow(/busy/);
    await expect(
      chatCompletion(msg, { apiKey: "sk-test", models: ["a/1"], fetch: async () => new Response("x", { status: 500 }) }),
    ).rejects.toBeInstanceOf(AiError);
  });

  it("does not fall back when the key is rejected", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 401 }));
    await expect(chatCompletion(msg, { apiKey: "sk-test", models: ["a/1", "a/2"], fetch })).rejects.toThrow(/key was rejected/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses to call without a key or without a model", async () => {
    const fetch = vi.fn();
    await expect(chatCompletion(msg, { apiKey: "sk-test", models: [], fetch })).rejects.toThrow(/No AI model/);
    await expect(chatCompletion(msg, { apiKey: "", models: ["a/1"], fetch })).rejects.toThrow(/not configured/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("verifyKey tells valid, rejected and unverified keys apart", async () => {
    const valid = vi.fn(async () => new Response(JSON.stringify({ data: { label: "learn", is_free_tier: true } })));
    expect(await verifyKey("sk-or-1", { fetch: valid })).toEqual({ status: "valid", label: "learn", freeTier: true });
    const [url, init] = valid.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-or-1");
    expect(await verifyKey("x", { fetch: async () => new Response("", { status: 401 }) })).toEqual({ status: "rejected" });
    expect(await verifyKey("x", { fetch: async () => new Response("", { status: 502 }) })).toEqual({ status: "unverified" });
    expect(
      await verifyKey("x", {
        fetch: async () => {
          throw new TypeError("offline");
        },
      }),
    ).toEqual({ status: "unverified" });
  });

  it("extractJson finds the object inside fences or prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
    expect(extractJson("no json")).toBeNull();
    expect(extractJson("{broken")).toBeNull();
  });

  describe("catalogue", () => {
    const raw = {
      data: [
        {
          id: "z/paid",
          name: "Zed Paid",
          context_length: 8000,
          pricing: { prompt: "0.000001", completion: "0.000002" },
          supported_parameters: ["temperature"],
        },
        {
          id: "b/model:free",
          name: "Bee Free",
          context_length: 131072,
          pricing: { prompt: "0", completion: "0" },
          supported_parameters: ["temperature", "response_format"],
          architecture: { input_modalities: ["text", "image"] },
        },
        { id: "a/zero", name: "Ay Zero", pricing: { prompt: "0", completion: "0" } },
        { id: "i/image", name: "Image only", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["image"] } },
        { id: "m/music", name: "Music", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["text", "audio"] } },
        { id: "p/picture", name: "Picture", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["image", "text"] } },
        { id: "openrouter/auto", name: "Auto", pricing: { prompt: "-1", completion: "-1" } },
        { name: "no id" },
      ],
    };

    it("lists text models with free ones first, sorted by name", () => {
      expect(parseCatalog(raw)).toEqual([
        { id: "b/model:free", name: "Bee Free", free: true, contextLength: 131072, json: true, images: true },
        { id: "a/zero", name: "Ay Zero", free: true, contextLength: null, json: null, images: false },
        { id: "openrouter/auto", name: "Auto", free: false, contextLength: null, json: null, images: false },
        { id: "z/paid", name: "Zed Paid", free: false, contextLength: 8000, json: false, images: false },
      ]);
      expect(parseCatalog(null)).toEqual([]);
    });

    it("caches the list and reports a failure without throwing", async () => {
      const fetch = vi.fn(async () => new Response(JSON.stringify(raw)));
      expect((await listCatalog({ fetch, now: 0 })).models).toHaveLength(4);
      await listCatalog({ fetch, now: 60_000 });
      expect(fetch).toHaveBeenCalledTimes(1);
      await listCatalog({ fetch, now: 11 * 60_000 });
      expect(fetch).toHaveBeenCalledTimes(2);

      resetCatalogCache();
      const failed = await listCatalog({ fetch: async () => new Response("", { status: 503 }) });
      expect(failed.models).toEqual([]);
      expect(failed.error).toMatch(/type a model id/);
    });
  });

  it("checkModels tries each model on its own and reports the outcome", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply('{"ok": true}'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "No endpoints found matching your data policy", code: 404 } }), {
          status: 404,
        }),
      );
    const results = await checkModels(["a/1", "a/2"], { apiKey: "sk-test", fetch });
    expect(JSON.parse(fetch.mock.calls[0][1].body).response_format.type).toBe("json_schema");
    expect(results.map(({ model, ok }) => ({ model, ok }))).toEqual([
      { model: "a/1", ok: true },
      { model: "a/2", ok: false },
    ]);
    expect(results[1].error).toMatch(/failed/);
    expect(results[1].error).toMatch(/HTTP 404 · No endpoints found matching your data policy/);
  });

  it("keeps OpenRouter's reason as detail, not in the learner-facing message", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Insufficient credits" } }), { status: 402 }),
    );
    const error = await chatCompletion(msg, { apiKey: "sk-test", models: ["a/1"], fetch }).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.message).toMatch(/out of credits/);
    expect(error.message).not.toMatch(/HTTP/);
    expect(error.detail).toBe("HTTP 402 · Insufficient credits");
  });

  it("checkModels fails a model whose reply is not JSON", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply("OK"));
    const [result] = await checkModels(["a/1"], { apiKey: "sk-test", fetch });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unreadable/);
  });
});
