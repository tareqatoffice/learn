import { describe, expect, it } from "vitest";
import { clampPos, parsePos, placeAt } from "@/features/focus/lib/position";

const box = { width: 48, height: 48 };
const vp = { width: 400, height: 800, minBottom: 72 };

describe("focus button position", () => {
  it("anchors to the nearer side", () => {
    expect(placeAt(20, 300, box, vp)).toEqual({ side: "left", x: 20, bottom: 452 });
    expect(placeAt(300, 300, box, vp)).toEqual({ side: "right", x: 52, bottom: 452 });
  });

  it("keeps the button on screen and above the bottom nav", () => {
    expect(placeAt(-50, 2000, box, vp)).toEqual({ side: "left", x: 8, bottom: 72 });
    expect(placeAt(9999, -50, box, vp)).toEqual({ side: "right", x: 8, bottom: 800 - 48 - 8 });
    expect(clampPos({ side: "right", x: 900, bottom: 10 }, box, vp)).toEqual({ side: "right", x: 400 - 48 - 8, bottom: 72 });
  });

  it("parses a stored position and rejects junk", () => {
    expect(parsePos(JSON.stringify({ side: "left", x: 10, bottom: 90 }))).toEqual({ side: "left", x: 10, bottom: 90 });
    expect(parsePos(null)).toBeNull();
    expect(parsePos("{oops")).toBeNull();
    expect(parsePos(JSON.stringify({ side: "top", x: 1, bottom: 1 }))).toBeNull();
    expect(parsePos(JSON.stringify({ side: "left", x: "1", bottom: 1 }))).toBeNull();
  });
});
