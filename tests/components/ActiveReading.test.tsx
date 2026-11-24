import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreReadQuestions, ReciteList } from "@/features/notes/components/ActiveReading";

const { savePreQuestionsAction, saveRecitationAction } = vi.hoisted(() => ({
  savePreQuestionsAction: vi.fn<(noteId: string, questions: string[]) => Promise<void>>(() => Promise.resolve()),
  saveRecitationAction: vi.fn<(noteId: string, anchor: string, text: string, verdict: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}));
vi.mock("@/app/(app)/notes/actions", () => ({ savePreQuestionsAction, saveRecitationAction }));

afterEach(() => {
  cleanup();
  savePreQuestionsAction.mockClear();
  saveRecitationAction.mockClear();
});

const sections = [
  { anchor: "bridge", text: "Bridge networks" },
  { anchor: "ports", text: "Published ports" },
];

describe("PreReadQuestions", () => {
  it("saves the written questions", async () => {
    const user = userEvent.setup();
    render(<PreReadQuestions noteId="n1" initial={[]} />);
    await user.type(screen.getByPlaceholderText("Question 1"), "What is a bridge?");
    await user.type(screen.getByPlaceholderText("Question 2"), "Why publish ports?");
    await user.click(screen.getByRole("button", { name: "Save questions" }));

    expect(savePreQuestionsAction).toHaveBeenCalledWith("n1", ["What is a bridge?", "Why publish ports?"]);
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText(/2 questions/)).toBeTruthy();
  });

  it("stays open after saving so the confirmation is visible", async () => {
    const user = userEvent.setup();
    const { container } = render(<PreReadQuestions noteId="n1" initial={[]} />);
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
    await user.type(screen.getByPlaceholderText("Question 1"), "What is a bridge?");
    await user.click(screen.getByRole("button", { name: "Save questions" }));
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("starts collapsed with saved questions and reports a failed save", async () => {
    const user = userEvent.setup();
    savePreQuestionsAction.mockRejectedValueOnce(new Error("down"));
    const { container } = render(<PreReadQuestions noteId="n1" initial={["What is a bridge?"]} />);
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
    expect((screen.getByPlaceholderText("Question 1") as HTMLInputElement).value).toBe("What is a bridge?");

    await user.click(screen.getByText(/Before you read/));
    await user.click(screen.getByRole("button", { name: "Save questions" }));
    expect(screen.getByRole("alert").textContent).toMatch(/could not save/i);
  });
});

describe("ReciteList", () => {
  it("saves a sentence with the chosen verdict", async () => {
    const user = userEvent.setup();
    render(<ReciteList noteId="n1" sections={sections} initial={{}} questions={[]} />);
    const row = screen.getByText("Bridge networks").closest("li")!;
    await user.type(within(row).getByRole("textbox"), "Containers on a bridge reach each other");
    await user.click(within(row).getByRole("button", { name: "Review" }));

    expect(saveRecitationAction).toHaveBeenCalledWith("n1", "bridge", "Containers on a bridge reach each other", "review");
    expect(within(row).getByRole("button", { name: "Review" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/1 to review/)).toBeTruthy();
  });

  it("asks for a sentence before saving", async () => {
    const user = userEvent.setup();
    render(<ReciteList noteId="n1" sections={sections} initial={{}} questions={[]} />);
    const row = screen.getByText("Published ports").closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Got it" }));

    expect(saveRecitationAction).not.toHaveBeenCalled();
    expect(within(row).getByRole("alert").textContent).toMatch(/write one sentence/i);
  });

  it("shows saved recitations, the reader's questions, and keeps the old verdict on failure", async () => {
    const user = userEvent.setup();
    saveRecitationAction.mockRejectedValueOnce(new Error("down"));
    render(
      <ReciteList
        noteId="n1"
        sections={sections}
        initial={{ bridge: { text: "Saved idea", verdict: "review" } }}
        questions={["What is a bridge?"]}
      />,
    );
    expect(screen.getByText("What is a bridge?")).toBeTruthy();
    expect(screen.getByText(/1 to review/)).toBeTruthy();
    const row = screen.getByText("Bridge networks").closest("li")!;
    expect((within(row).getByRole("textbox") as HTMLTextAreaElement).value).toBe("Saved idea");

    await user.click(within(row).getByRole("button", { name: "Got it" }));
    expect(within(row).getByRole("alert").textContent).toMatch(/could not save/i);
    expect(within(row).getByRole("button", { name: "Review" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("only counts review marks for sections that still exist", () => {
    render(
      <ReciteList
        noteId="n1"
        sections={sections}
        initial={{
          bridge: { text: "Idea", verdict: "review" },
          "renamed-away": { text: "Old idea", verdict: "review" },
        }}
        questions={[]}
      />,
    );
    expect(screen.getByText(/1 to review/)).toBeTruthy();
  });

  it("drops the verdict highlight once the sentence is edited, until it is saved again", async () => {
    const user = userEvent.setup();
    render(<ReciteList noteId="n1" sections={sections} initial={{ bridge: { text: "Saved idea", verdict: "got" } }} questions={[]} />);
    const row = screen.getByText("Bridge networks").closest("li")!;
    expect(within(row).getByRole("button", { name: "Got it" }).getAttribute("aria-pressed")).toBe("true");

    await user.type(within(row).getByRole("textbox"), " and more");
    expect(within(row).getByRole("button", { name: "Got it" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(row).getByText(/Edited/)).toBeTruthy();

    await user.click(within(row).getByRole("button", { name: "Review" }));
    expect(saveRecitationAction).toHaveBeenCalledWith("n1", "bridge", "Saved idea and more", "review");
    expect(within(row).getByRole("button", { name: "Review" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(row).queryByText(/Edited/)).toBeNull();
  });

  it("renders nothing without sections", () => {
    const { container } = render(<ReciteList noteId="n1" sections={[]} initial={{}} questions={[]} />);
    expect(container.textContent).toBe("");
  });
});
