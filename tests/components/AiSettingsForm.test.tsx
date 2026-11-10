// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogModel } from "@/lib/openrouter";

const { saveAiSettingsAction, testAiModelsAction, refresh } = vi.hoisted(() => ({
  saveAiSettingsAction: vi.fn(),
  testAiModelsAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/admin/ai/actions", () => ({ saveAiSettingsAction, testAiModelsAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AiSettingsForm } from "@/components/admin/AiSettingsForm";

const catalog: CatalogModel[] = [
  { id: "meta/llama:free", name: "Llama (free)", free: true, contextLength: 131072, json: true, images: false },
  { id: "google/gemma:free", name: "Gemma (free)", free: true, contextLength: 8192, json: false, images: false },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini", free: false, contextLength: 128000, json: true, images: true },
];

const initial = { enabled: true, primaryModel: "meta/llama:free", fallbackModel: "", dailyLimit: 100 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(over: Partial<Parameters<typeof AiSettingsForm>[0]> = {}) {
  render(<AiSettingsForm initial={initial} keyConfigured catalog={catalog} {...over} />);
  return userEvent.setup();
}

const optionTexts = (select: HTMLElement) => within(select).getAllByRole("option").map((o) => o.textContent);

describe("AiSettingsForm", () => {
  it("lists free models only until paid ones are asked for", async () => {
    const user = setup();
    const primary = screen.getByLabelText("Primary model");
    expect(optionTexts(primary)).toEqual([
      "Llama (free) · 131k context",
      "Gemma (free) · 8k context · no JSON mode",
      "Other model id…",
    ]);
    expect(optionTexts(screen.getByLabelText("Backup model"))[0]).toBe("No backup");
    await user.click(screen.getByLabelText(/also list paid models/i));
    expect(optionTexts(primary)).toContain("GPT-4o mini · 128k context");
  });

  it("warns when the chosen model has no JSON mode", () => {
    setup({ initial: { ...initial, primaryModel: "google/gemma:free" } });
    expect(screen.getByText(/does not support JSON replies/i)).toBeTruthy();
  });

  it("saves a backup model, a custom primary id and the daily limit", async () => {
    saveAiSettingsAction.mockResolvedValue({ ok: true });
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Backup model"), "google/gemma:free");
    await user.selectOptions(screen.getByLabelText("Primary model"), "Other model id…");
    const custom = screen.getByLabelText("Primary model id");
    await user.clear(custom);
    await user.type(custom, "mistral/small:free");
    const limit = screen.getByLabelText(/AI calls per learner per day/);
    await user.clear(limit);
    await user.type(limit, "25");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(saveAiSettingsAction).toHaveBeenCalledWith({
      enabled: true,
      primaryModel: "mistral/small:free",
      fallbackModel: "google/gemma:free",
      dailyLimit: 25,
    });
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("saves a vision model chosen from image-capable models", async () => {
    saveAiSettingsAction.mockResolvedValue({ ok: true });
    const user = setup();
    await user.click(screen.getByLabelText(/also list paid models/i));
    const vision = screen.getByLabelText("Vision model");
    expect(optionTexts(vision)).toEqual(["Use the primary model", "GPT-4o mini · 128k context", "Other model id…"]);
    await user.selectOptions(vision, "openai/gpt-4o-mini");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(saveAiSettingsAction).toHaveBeenCalledWith(expect.objectContaining({ visionModel: "openai/gpt-4o-mini" }));
  });

  it("shows a saved model that is not in the catalogue as a custom id", () => {
    setup({ initial: { ...initial, primaryModel: "gone/model:free" } });
    expect((screen.getByLabelText("Primary model id") as HTMLInputElement).value).toBe("gone/model:free");
  });

  it("shows field errors from the server", async () => {
    saveAiSettingsAction.mockResolvedValue({ ok: false, errors: { fallbackModel: "Pick a different model than the primary one" } });
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect((await screen.findAllByText(/Pick a different model/)).length).toBeGreaterThan(0);
  });

  it("tests the chosen models and shows the results", async () => {
    testAiModelsAction.mockResolvedValue([{ model: "meta/llama:free", ok: false, ms: 900, error: "The AI coach is busy right now." }]);
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Test models" }));
    expect(testAiModelsAction).toHaveBeenCalledWith(["meta/llama:free"]);
    const results = await screen.findByRole("list", { name: "Model test results" });
    expect(results.textContent).toContain("busy right now");
  });

  it("falls back to a text box when the catalogue could not be loaded", () => {
    setup({ catalog: [], catalogError: "Could not load OpenRouter's model list. You can still type a model id." });
    expect(screen.getByText(/Could not load/)).toBeTruthy();
    expect((screen.getByLabelText("Primary model") as HTMLInputElement).value).toBe("meta/llama:free");
  });
});
