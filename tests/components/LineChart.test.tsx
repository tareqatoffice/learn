// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LineChart } from "@/components/charts/LineChart";

afterEach(cleanup);

type P = { d: string; a?: number; b?: number; c?: number };
const points: P[] = [
  { d: "Mon", a: 5, b: 6, c: 7 },
  { d: "Tue", a: 6, c: 7.5 },
  { d: "Wed", a: 6.5, b: 7 },
];
const base = {
  points,
  yDomain: [4, 9] as [number, number],
  xLabel: (p: P) => p.d,
};
const series = [
  { key: "a", label: "Series A", color: "var(--chart-1)", pick: (p: P) => p.a },
  { key: "b", label: "Series B", color: "var(--chart-2)", dash: "4 3", pick: (p: P) => p.b },
  { key: "none", label: "Empty", color: "var(--chart-3)", pick: () => undefined },
  { key: "c", label: "Official", color: "var(--chart-4)", pick: (p: P) => p.c, dotsOnly: true },
];

describe("LineChart", () => {
  it("draws one path per series that has values, none for dotsOnly or empty series", () => {
    const { container } = render(<LineChart {...base} series={series} />);
    expect(container.querySelectorAll("svg[role=img] path")).toHaveLength(2);
  });

  it("draws circles for every value and a gap stays a gap in the line", () => {
    const { container } = render(<LineChart {...base} series={series} />);
    expect(container.querySelectorAll("svg[role=img] circle")).toHaveLength(3 + 2 + 2);
    const b = container.querySelectorAll("svg[role=img] path")[1].getAttribute("d")!;
    expect(b.match(/M/g)).toHaveLength(2);
    expect(b).not.toContain("L");
  });

  it("shows a legend label only for series with values", () => {
    render(<LineChart {...base} series={series} />);
    expect(screen.getByText("Series A")).toBeTruthy();
    expect(screen.getByText("Series B")).toBeTruthy();
    expect(screen.getByText("Official")).toBeTruthy();
    expect(screen.queryByText("Empty")).toBeNull();
  });

  it("draws a labelled horizontal line per refLine and a vertical refX", () => {
    const { container } = render(
      <LineChart {...base} series={series} refLines={[{ y: 7, label: "Target 7" }]} refX={{ index: 1, label: "Test day" }} />,
    );
    const ref = container.querySelector("line[data-ref=y]")!;
    expect(ref.getAttribute("y1")).toBe(ref.getAttribute("y2"));
    expect(screen.getByText("Target 7")).toBeTruthy();
    const rx = container.querySelector("line[data-ref=x]")!;
    expect(rx.getAttribute("x1")).toBe(rx.getAttribute("x2"));
    expect(screen.getByText("Test day")).toBeTruthy();
  });

  it("uses xLabel in the point tooltips", () => {
    const { container } = render(<LineChart {...base} series={series} />);
    const titles = [...container.querySelectorAll("circle title")].map((t) => t.textContent);
    expect(titles).toContain("Series A, Tue: 6");
  });
});
