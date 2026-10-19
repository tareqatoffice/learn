// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopicPanel, type TopicPanelProps } from "@/components/TopicPanel";

const { startQuizAction } = vi.hoisted(() => ({
  startQuizAction: vi.fn<(filter: unknown) => Promise<{ empty: true }>>(() => Promise.resolve({ empty: true })),
}));
vi.mock("@/app/(app)/interview/actions", () => ({ startQuizAction }));

afterEach(() => {
  cleanup();
  startQuizAction.mockClear();
});

const node: TopicPanelProps["node"] = {
  id: "n1",
  slug: "closures",
  title: "Closures",
  trackName: "Functions & scope",
  summary: "A function keeps access to its **outer** scope.",
  points: ["Created on every call", "Used for `private` state"],
  code: "function counter() {\n  let n = 0;\n  return () => ++n;\n}",
  pitfall: "Using var in a loop.",
  docsUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
};

function setup(over: Partial<TopicPanelProps> = {}) {
  const onStatus = vi.fn();
  render(
    <TopicPanel
      node={node}
      status="learning"
      onStatus={onStatus}
      related={{ questions: [], notes: [], prereqs: [] }}
      {...over}
    />,
  );
  return { onStatus, user: userEvent.setup() };
}

describe("TopicPanel", () => {
  it("shows the topic content", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Closures" })).toBeTruthy();
    expect(screen.getByText("outer").tagName).toBe("STRONG");
    expect(screen.getByText("Using var in a loop.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /docs/i }).getAttribute("href")).toBe(node.docsUrl);
  });

  it("marks the current status chip as pressed", () => {
    setup();
    expect(screen.getByRole("button", { name: "Learning" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Done" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onStatus('done') when Done is clicked", async () => {
    const { onStatus, user } = setup();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onStatus).toHaveBeenCalledWith("done");
  });

  it("maps Not started to 'none'", async () => {
    const { onStatus, user } = setup();
    await user.click(screen.getByRole("button", { name: "Not started" }));
    expect(onStatus).toHaveBeenCalledWith("none");
  });

  it("hides Quiz these when there are no related questions", () => {
    setup();
    expect(screen.queryByRole("button", { name: /quiz these/i })).toBeNull();
  });

  it("starts a quiz over the related questions", async () => {
    const { user } = setup({
      related: {
        questions: [
          { id: "q1", title: "What is a closure?", href: "/interview/js/q1" },
          { id: "q2", title: "Closures in loops", href: "/interview/js/q2" },
        ],
        notes: [{ title: "JS internals § Closures", href: "/notes/js/internals#closures" }],
        prereqs: [{ slug: "functions", title: "Functions", status: "done" }],
      },
    });
    expect(screen.getByRole("link", { name: "JS internals § Closures" }).getAttribute("href")).toBe(
      "/notes/js/internals#closures",
    );
    await user.click(screen.getByRole("button", { name: /quiz these/i }));
    expect(startQuizAction).toHaveBeenCalledWith({
      questionIds: ["q1", "q2"],
      mode: "all",
      bookIds: [],
      partKeys: [],
      size: null,
    });
  });
});
