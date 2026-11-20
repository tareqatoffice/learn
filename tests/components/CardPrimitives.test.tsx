import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { CheckMark, ProgressRing } from "@/components/ProgressRing";

afterEach(cleanup);

describe("Panel", () => {
  it("labels each panel by its own heading even when two share a title", () => {
    render(
      <>
        <Panel title="Notes">
          <p>one</p>
        </Panel>
        <Panel title="Notes">
          <p>two</p>
        </Panel>
      </>,
    );
    const regions = screen.getAllByRole("region", { name: "Notes" });
    expect(regions).toHaveLength(2);
    const ids = regions.map((r) => r.getAttribute("aria-labelledby"));
    expect(new Set(ids).size).toBe(2);
  });

  it("renders the action slot and a track dot only when a track is given", () => {
    const { container, rerender } = render(
      <Panel title="Plain" action={<button>Act</button>}>
        x
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
    expect(container.querySelector("h2 [aria-hidden]")).toBeNull();
    rerender(
      <Panel title="Tracked" track="notes">
        x
      </Panel>,
    );
    expect(container.querySelector("h2 [aria-hidden]")).not.toBeNull();
  });
});

describe("PageHeader", () => {
  it("renders the title as the page h1 with description and actions", () => {
    render(<PageHeader title="Learning graphs" track="graphs" description="3 of 9 topics done." actions={<a href="/x">More</a>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Learning graphs" })).toBeTruthy();
    expect(screen.getByText("3 of 9 topics done.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "More" })).toBeTruthy();
  });
});

describe("ProgressRing", () => {
  it("is hidden from assistive tech and shows its centre content", () => {
    const { container } = render(
      <ProgressRing value={1} max={4} track="graphs">
        <span>25%</span>
      </ProgressRing>,
    );
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("25%", { selector: "span" })).toBeTruthy();
  });

  it("clamps the arc to a full ring and turns green when done", () => {
    const { container } = render(
      <ProgressRing value={9} max={4} track="notes" done>
        <CheckMark />
      </ProgressRing>,
    );
    const arc = container.querySelector("circle.ring-fill");
    expect(arc?.getAttribute("stroke")).toBe("var(--ok)");
    expect(Number(arc?.getAttribute("stroke-dashoffset"))).toBeCloseTo(0);
  });

  it("draws an empty arc when there is nothing to measure against", () => {
    const { container } = render(<ProgressRing value={0} max={0} track="notes" />);
    const arc = container.querySelector("circle.ring-fill");
    expect(Number(arc?.getAttribute("stroke-dashoffset"))).toBeCloseTo(Number(arc?.getAttribute("stroke-dasharray")));
  });
});
