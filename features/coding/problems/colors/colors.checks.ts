import { contrastRatio, hexToRgb, mixColors, rgbToHex } from "./colors";
import { eq, throws } from "../harness";
import type { Group } from "../harness";

export const colors: Group = {
  slug: "colors",
  title: "Colors",
  level: "Intermediate",
  questions: [
    {
      name: "hexToRgb",
      checks: [
        eq("Parses six digits", () => hexToRgb("#ff8000"), { r: 255, g: 128, b: 0 }),
        eq("Parses three digits", () => hexToRgb("#F0a"), { r: 255, g: 0, b: 170 }),
        throws("Throws on bad input", () => hexToRgb("#12")),
      ],
    },
    {
      name: "rgbToHex",
      checks: [
        eq("Pads channels", () => rgbToHex({ r: 0, g: 10, b: 255 }), "#000aff"),
        eq("Rounds", () => rgbToHex({ r: 0.4, g: 0.6, b: 0 }), "#000100"),
        eq("Limits the range", () => rgbToHex({ r: 300, g: -5, b: 0 }), "#ff0000"),
      ],
    },
    {
      name: "contrastRatio",
      checks: [
        eq("Black on white is 21", () => contrastRatio("#000", "#fff"), 21),
        eq("Order does not matter", () => contrastRatio("#fff", "#777") === contrastRatio("#777", "#fff"), true),
        eq("Same color is 1", () => contrastRatio("#123456", "#123456"), 1),
      ],
    },
    {
      name: "mixColors",
      checks: [
        eq("t = 0 is the first color", () => mixColors("#000000", "#ffffff", 0), "#000000"),
        eq("t = 1 is the second color", () => mixColors("#000000", "#ffffff", 1), "#ffffff"),
        eq("Blends at 0.5", () => mixColors("#000000", "#ffffff", 0.5), "#808080"),
      ],
    },
  ],
};
