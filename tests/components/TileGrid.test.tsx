import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TileGrid, type Tile } from "@/components/TileGrid";

const tile = (key: string, value: number, max: number, extra: Partial<Tile> = {}): Tile => ({
  key,
  href: `/x/${key}`,
  title: `Title ${key}`,
  value,
  max,
  stat: `${value} of ${max}`,
  ...extra,
});

const tiles = [tile("a", 4, 4), tile("b", 1, 4), tile("c", 0, 4), tile("d", 2, 4)];

afterEach(cleanup);

const hrefs = () => screen.getAllByRole("link").map((l) => l.getAttribute("href"));

describe("TileGrid", () => {
  it("renders every tile as a link, with a Finished badge on completed ones", () => {
    render(<TileGrid tiles={tiles} track="graphs" empty="Nothing." />);
    expect(hrefs()).toEqual(["/x/a", "/x/b", "/x/c", "/x/d"]);
    expect(within(screen.getByRole("list")).getAllByText("Finished")).toHaveLength(1);
  });

  it("shows the empty message when there are no tiles", () => {
    render(<TileGrid tiles={[]} track="notes" empty="No notes published yet." />);
    expect(screen.getByText("No notes published yet.")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("filters by progress status and shows counts on the chips", async () => {
    const user = userEvent.setup();
    render(<TileGrid tiles={tiles} track="graphs" empty="Nothing." />);
    expect(screen.getByRole("button", { name: /In progress/ }).textContent).toContain("2");
    await user.click(screen.getByRole("button", { name: /In progress/ }));
    expect(hrefs()).toEqual(["/x/b", "/x/d"]);
    await user.click(screen.getByRole("button", { name: /Not started/ }));
    expect(hrefs()).toEqual(["/x/c"]);
    await user.click(screen.getByRole("button", { name: /Finished/ }));
    expect(hrefs()).toEqual(["/x/a"]);
    await user.click(screen.getByRole("button", { name: /All/ }));
    expect(hrefs()).toHaveLength(4);
  });

  it("hides the filter for short lists", () => {
    render(<TileGrid tiles={tiles.slice(0, 3)} track="graphs" empty="Nothing." />);
    expect(screen.queryByRole("group", { name: "Filter by progress" })).toBeNull();
  });

  it("groups tiles under headings in order of first appearance", () => {
    const grouped = [
      tile("a", 0, 2, { group: "React" }),
      tile("b", 0, 2, { group: "JavaScript" }),
      tile("c", 0, 2, { group: "React" }),
      tile("d", 0, 2, { group: "JavaScript" }),
    ];
    render(<TileGrid tiles={grouped} track="coding" empty="Nothing." />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["React", "JavaScript"]);
    const react = screen.getByRole("region", { name: "React" });
    expect(within(react).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/x/a", "/x/c"]);
  });
});
