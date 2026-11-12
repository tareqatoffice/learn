// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeakingHub, type HubOption } from "@/components/ielts/SpeakingHub";

vi.mock("@/app/(app)/ielts/speaking/actions", () => ({ generateQuestionsAction: vi.fn(), startAttemptAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const mock = (over: Partial<HubOption> = {}): HubOption => ({
  kind: "mock",
  title: "Full mock",
  blurb: "All three parts.",
  exhausted: true,
  missing: true,
  ...over,
});
const renderHub = (option: HubOption, aiOn: boolean) =>
  render(<SpeakingHub options={[option]} recent={[]} aiOn={aiOn} storage highlightMock={false} />);
const card = () => within(screen.getByRole("listitem", { name: "Full mock" }));

describe("SpeakingHub", () => {
  it("says the bank is short, with no way to start, when AI is off and the bank can't form a mock", () => {
    renderHub(mock(), false);
    expect(card().getByText("Not enough questions in the bank yet — ask your admin to add some")).toBeTruthy();
    expect(card().queryByRole("button")).toBeNull();
  });

  it("offers only generation when AI is on and the bank can't form a mock", () => {
    renderHub(mock(), true);
    expect(card().getByRole("button", { name: "Generate new questions" })).toBeTruthy();
    expect(card().queryByRole("button", { name: /repeat earlier/i })).toBeNull();
  });

  it("offers repeats when the bank is used up but can still form a mock", () => {
    renderHub(mock({ missing: false }), false);
    expect(card().getByRole("button", { name: "Repeat earlier questions" })).toBeTruthy();
    expect(card().queryByText(/not enough questions/i)).toBeNull();
  });
});
