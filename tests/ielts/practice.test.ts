import { describe, expect, it } from "vitest";
import { formatQuestions, parseQuestions } from "@/ielts/practice/format";
import { isCorrect, numberSections, scoreSections, toPublic, type Section } from "@/ielts/practice/marking";

const TEXT = `## tfng | Do the statements agree?
The earth is flat. => FALSE ~ It is round.
Water is wet. => true

## mcq | Choose the letter.
Main idea? => B
  A. one
  B. two

## matching | Match.
> A. Red
> B. Blue
Sky => B

## completion | NO MORE THAN TWO WORDS
The ___ is large. => big | huge`;

function parse() {
  const r = parseQuestions(TEXT);
  if (!r.ok) throw new Error(r.errors.join("; "));
  return r.groups;
}

describe("parseQuestions", () => {
  it("parses groups, options, answers and explanations", () => {
    const groups = parse();
    expect(groups.map((g) => g.kind)).toEqual(["tfng", "mcq", "matching", "completion"]);
    expect(groups[0].questions[0]).toMatchObject({ answers: ["FALSE"], explanation: "It is round." });
    expect(groups[1].questions[0].options).toEqual(["one", "two"]);
    expect(groups[2].options).toEqual(["Red", "Blue"]);
    expect(groups[3].questions[0].answers).toEqual(["big", "huge"]);
  });

  it("round-trips through formatQuestions", () => {
    const again = parseQuestions(formatQuestions(parse()));
    expect(again).toEqual({ ok: true, groups: parse() });
  });

  it("reports errors with line numbers", () => {
    const r = parseQuestions("No group yet => A\n## nope | x\n## mcq | y\nQ => Z\n  A. a\n  B. b");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toMatch(/Line 1/);
      expect(r.errors.join(" ")).toMatch(/unknown question type/);
      expect(r.errors.join(" ")).toMatch(/not one of the option letters/);
    }
  });

  it("rejects an empty text", () => {
    expect(parseQuestions("  ").ok).toBe(false);
  });
});

describe("isCorrect", () => {
  it("normalises case, spaces and a trailing full stop", () => {
    expect(isCorrect({ kind: "completion", answers: ["big"] }, "  BIG. ")).toBe(true);
    expect(isCorrect({ kind: "completion", answers: ["red car"] }, "red   car")).toBe(true);
  });
  it("ignores a leading article for completion only", () => {
    expect(isCorrect({ kind: "completion", answers: ["bus"] }, "the bus")).toBe(true);
    expect(isCorrect({ kind: "completion", answers: ["the bus"] }, "bus")).toBe(true);
  });
  it("accepts TFNG aliases and option letters", () => {
    expect(isCorrect({ kind: "tfng", answers: ["NOT GIVEN"] }, "ng")).toBe(true);
    expect(isCorrect({ kind: "ynng", answers: ["YES"] }, "Y")).toBe(true);
    expect(isCorrect({ kind: "mcq", answers: ["B"] }, "b")).toBe(true);
    expect(isCorrect({ kind: "mcq", answers: ["B"] }, "A")).toBe(false);
  });
  it("blank is wrong", () => {
    expect(isCorrect({ kind: "completion", answers: ["x"] }, "   ")).toBe(false);
    expect(isCorrect({ kind: "completion", answers: ["x"] }, undefined)).toBe(false);
  });
});

describe("scoreSections", () => {
  const section = (): Section => ({ title: "S", passage: "p", script: "", audioKey: "", durationSec: 0, groups: parse() });

  it("numbers questions and marks them", () => {
    const sections = [section()];
    expect(numberSections(sections)).toBe(5);
    const score = scoreSections("reading", sections, { "1": "false", "2": "TRUE", "3": "B", "4": "B", "5": "huge" });
    expect(score.raw).toBe(5);
    expect(score.total).toBe(5);
    expect(score.band).toBeUndefined();
  });

  it("gives a band only for a full 40-question test", () => {
    const groups = Array.from({ length: 40 }, (_, i) => ({
      kind: "completion" as const,
      instruction: "",
      options: [],
      questions: [{ n: 0, kind: "completion" as const, prompt: `q${i}`, options: [], answers: ["x"], explanation: "" }],
    }));
    const sections: Section[] = [{ title: "S", passage: "", script: "", audioKey: "", durationSec: 0, groups }];
    numberSections(sections);
    const answers = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [String(i + 1), "x"]));
    expect(scoreSections("listening", sections, answers)).toMatchObject({ raw: 30, total: 40, band: 7 });
    expect(scoreSections("reading", sections, answers)).toMatchObject({ raw: 30, total: 40, band: 7 });
  });

  it("toPublic leaves out answers, explanations and the script", () => {
    const sections = [{ ...section(), script: "secret script" }];
    numberSections(sections);
    const json = JSON.stringify(toPublic(sections));
    expect(json).not.toContain("secret script");
    expect(json).not.toContain("It is round");
    expect(json).not.toContain("answers");
  });
});
