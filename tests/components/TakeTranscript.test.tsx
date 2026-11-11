// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TakeTranscript } from "@/components/speaking/TakeReview";

const actions = vi.hoisted(() => ({
  transcribeTakeAction: vi.fn<(...args: unknown[]) => Promise<object>>(async () => ({ ok: true as const, transcript: "hello world" })),
  deleteTakeAction: vi.fn(),
}));
vi.mock("@/app/(app)/speaking/actions", () => actions);

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const takeId = "64b000000000000000000009";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TakeTranscript", () => {
  it("starts transcription once for a pending take, then refreshes", async () => {
    render(
      <StrictMode>
        <TakeTranscript takeId={takeId} status="pending" />
      </StrictMode>,
    );
    expect(screen.getByRole("status").textContent).toMatch(/transcribing/i);
    expect(await screen.findByText("hello world")).toBeTruthy();
    expect(actions.transcribeTakeAction).toHaveBeenCalledTimes(1);
    expect(actions.transcribeTakeAction).toHaveBeenCalledWith(takeId);
    expect(refresh).toHaveBeenCalled();
  });

  it("does not start transcription for other states", () => {
    render(<TakeTranscript takeId={takeId} status="done" transcript="said this" />);
    render(<TakeTranscript takeId={takeId} status="unavailable" />);
    expect(actions.transcribeTakeAction).not.toHaveBeenCalled();
    expect(screen.getByText(/transcripts aren't set up/i)).toBeTruthy();
  });

  it("offers Try again when transcription fails", async () => {
    actions.transcribeTakeAction.mockResolvedValueOnce({ ok: false, errors: { _: "Couldn't transcribe the recording. Try again." } });
    render(<TakeTranscript takeId={takeId} status="pending" />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't transcribe/i));
  });
});
