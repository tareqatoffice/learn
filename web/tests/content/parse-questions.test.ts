import { describe, expect, it } from "vitest";
import { parseBook } from "@/content/parse/questions";
import { importKey } from "@/lib/ids";

const md = (...lines: string[]) => lines.join("\n");

/** The legacy record shape, so the quiz-app cases can be compared as they were written. */
const records = (src: string, slug = "book") =>
  parseBook(src, slug).questions.map(({ question, part, prompt, answer }) => ({
    question,
    part,
    prompt,
    answer,
  }));

// Ported from quiz-app/test/parse.test.js. parseQuestionHeadings and parseNumberedSections
// are both reached through parseBook, which falls back to numbered sections when no Q heading exists.
describe("parseBook — legacy quiz-app cases", () => {
  it("extracts H2 questions with part and answer", () => {
    const src = md(
      "# Book", "",
      "# Part 1 — Basics", "",
      "## Q1. What is X?", "", "X is a thing.", "",
      "## Q2: What is Y?", "", "Y is another.", "",
      "# Part 2 — Advanced", "",
      "## Q3. What is Z?", "", "Z.",
    );
    expect(records(src)).toEqual([
      { question: "What is X?", part: "Part 1 — Basics", prompt: "", answer: "X is a thing." },
      { question: "What is Y?", part: "Part 1 — Basics", prompt: "", answer: "Y is another." },
      { question: "What is Z?", part: "Part 2 — Advanced", prompt: "", answer: "Z." },
    ]);
  });

  it("H3 questions keep deeper subsections, stop at next H3/H2, use H2 as part", () => {
    const src = md(
      "## 0. Warm-up", "",
      "### Q1. Intro?", "", "Say hi.", "", "#### Detail", "", "More.", "",
      "### Q2. Next?", "", "Next answer.", "",
      "## 1. JS", "",
      "### Q1. Closures?", "", "Remembering scope.",
    );
    const got = records(src);
    expect(got.length).toBe(3);
    expect(got[0].part).toBe("0. Warm-up");
    expect(got[0].answer).toBe("Say hi.\n\n#### Detail\n\nMore.");
    expect(got[1].answer).toBe("Next answer.");
    expect(got[2].part).toBe("1. JS");
  });

  it("ignores headings inside fenced code blocks", () => {
    const src = md(
      "# Part 1 — Ops", "",
      "## Q1. How to build?", "",
      "```dockerfile", "# build stage", "FROM node", "## Q99. Not a question", "```", "",
      "After the fence.", "",
      "## Q2. Next?", "", "Done.",
    );
    const got = records(src);
    expect(got.map((q) => q.question)).toEqual(["How to build?", "Next?"]);
    expect(got[0].answer).toMatch(/# build stage/);
    expect(got[0].answer).toMatch(/After the fence\./);
    expect(got[1].part).toBe("Part 1 — Ops");
  });

  it("a longer fence is not closed by a shorter inner fence", () => {
    const src = md(
      "## Q1. Markdown example?", "",
      "````md", "```js", "# not a heading", "```", "## Q9. still inside", "````", "",
      "## Q2. Next?", "", "ok",
    );
    expect(records(src).map((q) => q.question)).toEqual(["Markdown example?", "Next?"]);
  });

  it("handles CRLF line endings", () => {
    const src = md("## Q1. A?", "", "Answer A.", "", "## Q2. B?", "", "Answer B.").replace(/\n/g, "\r\n");
    const got = records(src);
    expect(got.map((q) => q.answer)).toEqual(["Answer A.", "Answer B."]);
    expect(got.map((q) => q.question)).toEqual(["A?", "B?"]);
  });

  it("strips trailing horizontal rules from answers", () => {
    const src = md("## Q1. A?", "", "Answer.", "", "---", "", "# Part 2 — More", "", "## Q2. B?", "", "B.");
    expect(records(src)[0].answer).toBe("Answer.");
  });

  it("keeps # inside heading text", () => {
    const src = md("## 2. C# basics", "", "## Q1. What is C#?", "", "A language.");
    const got = records(src);
    expect(got[0].question).toBe("What is C#?");
    expect(got[0].part).toBe("2. C# basics");
  });

  it("untitled puzzle headings use the leading code block(s) as the prompt", () => {
    const src = md(
      "# Section 9 — Puzzles", "",
      "### Q61.", "```js", "console.log(typeof typeof 1);", "```", '**`"string"`.** Inner typeof gives "number".', "", "---", "",
      "### Q62.", "```js", "a()", "```", "", "```js", "b()", "```", "Two blocks.",
    );
    expect(records(src)).toEqual([
      {
        question: "What does this code output?",
        part: "Section 9 — Puzzles",
        prompt: "```js\nconsole.log(typeof typeof 1);\n```",
        answer: '**`"string"`.** Inner typeof gives "number".',
      },
      {
        question: "What does this code output?",
        part: "Section 9 — Puzzles",
        prompt: "```js\na()\n```\n\n```js\nb()\n```",
        answer: "Two blocks.",
      },
    ]);
  });

  it("<details> answer blocks split into prompt and answer; <details> inside code is ignored", () => {
    const src = md(
      "## Q54. Which color is the text?", "",
      "```css", ".lead { color: green !important; }", "```", "",
      "<details><summary>Answer</summary>", "", "Green. `!important` wins.", "</details>", "", "---", "",
      "## Q55. What does the details element do?", "",
      "It makes a disclosure widget:", "",
      "```html", "<details><summary>Answer</summary>", "</details>", "```", "",
      "Native, no JS.",
    );
    const got = records(src);
    expect(got[0]).toEqual({
      question: "Which color is the text?",
      part: "",
      prompt: "```css\n.lead { color: green !important; }\n```",
      answer: "Green. `!important` wins.",
    });
    expect(got[1].prompt).toBe("");
    expect(got[1].answer).toMatch(/^It makes a disclosure widget:/);
    expect(got[1].answer).toMatch(/Native, no JS\.$/);
  });

  it("extracts bold numbered prompts, quoted bullets and Question/Answer tables outside Q sections", () => {
    const src = md(
      "# Part 1 — Basics", "",
      "## Q1. A?", "", "One.", "", "| Question | Answer |", "|---|---|", "| inside a Q answer | ignored |", "",
      "# Part 4 — Design", "",
      "## Design prompts", "", "Intro sentence.", "",
      "**1. Design a URL shortener.**", "Key generation and caching.", "",
      "**2. Design a notification service.**", "Channels and retries.", "",
      "## Behavioural", "", '- **"Tell me about an incident."** What broke and what changed.', "",
      "# Part 5 — Rapid-fire", "",
      "## Rapid-fire", "", "| Question | Answer |", "|---|---|", "| Default status for `@Post()`? | 201 |", "| Guards or pipes first? | Guards |", "",
      "## A 7-day prep plan", "", "**1. Day one.**", "Not a question.",
    );
    expect(records(src).map((q) => [q.part, q.question, q.answer])).toEqual([
      ["Part 1 — Basics", "A?", "One.\n\n| Question | Answer |\n|---|---|\n| inside a Q answer | ignored |"],
      ["Part 4 — Design", "Design a URL shortener", "Key generation and caching."],
      ["Part 4 — Design", "Design a notification service", "Channels and retries."],
      ["Part 4 — Design", "Tell me about an incident.", "What broke and what changed."],
      ["Part 5 — Rapid-fire", "Default status for `@Post()`?", "201"],
      ["Part 5 — Rapid-fire", "Guards or pipes first?", "Guards"],
    ]);
  });

  it("numbered sections: topics, design problems, rapid-fire, skipped sections", () => {
    const src = md(
      "# PART I — THE METHOD", "",
      "## Table of Contents", "", "- stuff", "",
      "## 1. The RADIO framework", "", "Requirements first.", "", "### Sub", "", "Detail.", "",
      "# PART III — THE QUESTION BANK", "",
      "## 17. Design a News Feed (Facebook / Twitter)", "", "Feed answer.", "",
      "## 41. Thirty rapid-fire questions with condensed answers", "",
      "1. **CSR vs SSR?** SSR for SEO.",
      "2. **Debounce vs throttle?** Debounce waits for quiet.",
      "   Throttle caps the rate.", "",
      "## 42. Cheat sheets", "", "table",
    );
    expect(records(src)).toEqual([
      { question: "Explain: The RADIO framework", part: "PART I — THE METHOD", prompt: "", answer: "Requirements first.\n\n### Sub\n\nDetail." },
      { question: "Design a News Feed (Facebook / Twitter)", part: "PART III — THE QUESTION BANK", prompt: "", answer: "Feed answer." },
      { question: "CSR vs SSR?", part: "PART III — THE QUESTION BANK", prompt: "", answer: "SSR for SEO." },
      { question: "Debounce vs throttle?", part: "PART III — THE QUESTION BANK", prompt: "", answer: "Debounce waits for quiet.\n   Throttle caps the rate." },
    ]);
  });

  it("extras ignore question markers inside fenced code in Q-less sections", () => {
    const src = md(
      "# Part 4 — Design", "",
      "## Notes", "",
      "**1. Real prompt.**", "Real answer.", "",
      "```md", "| Question | Answer |", "|---|---|", "| fake q | fake a |", "**2. Fake numbered.**", '- **"Fake quote"** x', "```", "",
    );
    const got = records(src);
    expect(got.map((q) => q.question)).toEqual(["Real prompt"]);
    expect(got[0].answer).toMatch(/^Real answer\./);
    expect(got[0].answer).toMatch(/\*\*2\. Fake numbered\.\*\*/);
  });

  it("rapid-fire items keep blank lines and fenced code; markers inside fences are not items", () => {
    const src = md(
      "## 41. Rapid-fire questions", "",
      "1. **Real?** Yes.", "   Second line.", "", "   Second paragraph.",
      "```js", "1. **Fake?** no", "", "const a = 1;", "```",
      "2. **Next?** ok",
    );
    expect(records(src)).toEqual([
      {
        question: "Real?",
        part: "",
        prompt: "",
        answer: "Yes.\n   Second line.\n\n   Second paragraph.\n```js\n1. **Fake?** no\n\nconst a = 1;\n```",
      },
      { question: "Next?", part: "", prompt: "", answer: "ok" },
    ]);
  });

  it("falls back to numbered sections and throws when nothing is found", () => {
    expect(parseBook(md("## 1. Topic", "", "Body."), "x").questions.length).toBe(1);
    expect(() => parseBook("# Just a title\n\nprose", "empty")).toThrow(/No questions found in empty/);
  });
});

// Ported from quiz-app/test/collect.test.js: ids are importKeys, with a per-book collision suffix.
describe("parseBook — importKeys", () => {
  it("same question text with different prompts gets different keys, equal to collect()'s ids", () => {
    const slug = "javascript-explained-ebook";
    const { questions } = parseBook("### Q1.\n```js\na()\n```\nOne.\n\n### Q2.\n```js\nb()\n```\nTwo.\n", slug);
    expect(questions.length).toBe(2);
    expect(questions[0].prompt).toBe("```js\na()\n```");
    expect(questions[0].importKey).toBe(importKey(slug, "What does this code output?", "```js\na()\n```"));
    expect(questions[1].importKey).toBe(importKey(slug, "What does this code output?", "```js\nb()\n```"));
    expect(questions[0].importKey).not.toBe(questions[1].importKey);
  });

  it("identical question and prompt get -2, -3 suffixes within a book", () => {
    const src = md("## Q1. Same?", "", "a", "", "## Q2. Same?", "", "b", "", "## Q3. Same?", "", "c");
    const base = importKey("bk", "Same?", "");
    expect(parseBook(src, "bk").questions.map((q) => q.importKey)).toEqual([base, `${base}-2`, `${base}-3`]);
  });

  it("collisions are counted per book, not across calls", () => {
    const src = md("## Q1. Same?", "", "a");
    expect(parseBook(src, "bk").questions[0].importKey).toBe(importKey("bk", "Same?", ""));
    expect(parseBook(src, "bk").questions[0].importKey).toBe(importKey("bk", "Same?", ""));
  });
});

describe("parseBook — B/T questions", () => {
  it("a ### B<n>. heading is a question with an empty prompt", () => {
    const src = md(
      "## 6b. Browser & networking", "",
      "### B3. Reflow vs repaint vs composite — what's the difference?", "",
      "- **Reflow:** geometry changes.", "", "**বাংলায়:**", "", "Reflow হয়।",
    );
    expect(records(src)).toEqual([
      {
        question: "Reflow vs repaint vs composite — what's the difference?",
        part: "6b. Browser & networking",
        prompt: "",
        answer: "- **Reflow:** geometry changes.\n\n**বাংলায়:**\n\nReflow হয়।",
      },
    ]);
  });

  it("a ### T<n>. body splits at the **Answer:** line into prompt and answer", () => {
    const src = md(
      "## 12. Tricky & trap questions", "",
      "### T5. What does this print?", "",
      "```javascript", "**Answer:** inside a fence is not the split", "console.log(3);", "```", "",
      "**Answer:** `3`. Because the log prints it.", "",
      "**বাংলায়:**", "", "Output হবে `3`।", "", "---",
    );
    const [q] = parseBook(src, "bk").questions;
    expect(q.question).toBe("What does this print?");
    expect(q.prompt).toBe("```javascript\n**Answer:** inside a fence is not the split\nconsole.log(3);\n```");
    expect(q.answer).toBe("`3`. Because the log prints it.\n\n**বাংলায়:**\n\nOutput হবে `3`।");
    expect(q.importKey).toBe(importKey("bk", "What does this print?", q.prompt));
  });

  it("a Q<n> heading with an **Answer:** line keeps its legacy record (and importKey)", () => {
    const src = md("### Q11. Review this?", "", "```tsx", "x()", "```", "", "**Answer:** missing deps.");
    expect(records(src)[0]).toEqual({
      question: "Review this?",
      part: "",
      prompt: "",
      answer: "```tsx\nx()\n```\n\n**Answer:** missing deps.",
    });
  });
});

describe("parseBook — title, intro, parts, extras", () => {
  const book = md(
    "# The CSS Question Book", "",
    "**A guide.**", "", "---", "",
    "## How to use this book", "", "Read it.", "",
    "### Contents", "", "1. Fundamentals", "", "---", "",
    "# Part 1 — Fundamentals", "",
    "## Q1. Cascade?", "", "Origins.", "", "---", "",
    "# Appendix — A 10-day study plan", "",
    "| Day | Read |", "|---|---|", "| 1 | Part 1 |", "",
    "## Final note", "", "Good luck.",
  );

  it("takes the H1 as title and the text before the first part, minus Contents, as intro", () => {
    const got = parseBook(book, "css");
    expect(got.title).toBe("The CSS Question Book");
    expect(got.intro).toBe("**A guide.**\n\n---\n\n## How to use this book\n\nRead it.");
    expect(got.parts).toEqual([{ key: "part-1-fundamentals", title: "Part 1 — Fundamentals", intro: "" }]);
  });

  it("an Appendix section becomes an extra with its body, including its sub-headings", () => {
    const got = parseBook(book, "css");
    expect(got.extras).toEqual([
      {
        key: "appendix-a-10-day-study-plan",
        title: "Appendix — A 10-day study plan",
        body: "| Day | Read |\n|---|---|\n| 1 | Part 1 |\n\n## Final note\n\nGood luck.",
      },
    ]);
    expect(got.questions.map((q) => q.answer)).toEqual(["Origins."]);
    expect(got.unaccounted).toEqual([]);
  });

  it("skipped legacy sections (prep plan, final advice, cheat sheets…) become extras", () => {
    const src = md(
      "# Part 5 — Rapid-fire and a prep plan", "",
      "## Rapid-fire", "", "| Question | Answer |", "|---|---|", "| Guards first? | Yes |", "",
      "## A 7-day prep plan", "", "**1. Day one.**", "Read.", "",
      "## Final advice", "", "Be calm.",
    );
    const got = parseBook(src, "nest");
    expect(got.questions.map((q) => q.question)).toEqual(["Guards first?"]);
    expect(got.extras.map((e) => [e.key, e.body])).toEqual([
      ["a-7-day-prep-plan", "**1. Day one.**\nRead."],
      ["final-advice", "Be calm."],
    ]);
    expect(got.parts).toEqual([
      { key: "part-5-rapid-fire-and-a-prep-plan", title: "Part 5 — Rapid-fire and a prep plan", intro: "## Rapid-fire" },
    ]);
    expect(got.unaccounted).toEqual([]);
  });

  it("H2 sections used as parts are listed as parts; sub-headings of questions are covered", () => {
    const src = md(
      "# Frontend Interview", "", "Intro.", "",
      "## Contents", "", "- [Warm-up](#0-warm-up)", "",
      "## 0. Warm-up", "",
      "### Q1. Intro?", "", "#### Detail", "", "Hi.",
    );
    const got = parseBook(src, "fi");
    expect(got.intro).toBe("Intro.");
    expect(got.parts).toEqual([{ key: "0-warm-up", title: "0. Warm-up", intro: "" }]);
    expect(got.unaccounted).toEqual([]);
  });

  it("numbered-section books: skipped sections are extras, the Table of Contents is dropped", () => {
    const src = md(
      "# Frontend System Design", "### A Complete Question Bank", "",
      "## Table of Contents", "", "- stuff", "",
      "# PART IV — RAPID-FIRE BANK & PREP PLAN", "",
      "Part lead-in.", "",
      "## 40. Design a Ticker", "", "Ticker answer.", "",
      "## 41. Rapid-fire questions", "", "Rapid-fire lead-in.", "", "1. **CSR vs SSR?** SSR for SEO.", "",
      "## 42. Cheat sheets", "", "### Numbers", "", "table",
    );
    const got = parseBook(src, "fsd");
    expect(got.title).toBe("Frontend System Design");
    expect(got.intro).toBe("### A Complete Question Bank");
    expect(got.questions.map((q) => q.question)).toEqual(["Design a Ticker", "CSR vs SSR?"]);
    expect(got.parts).toEqual([
      {
        key: "part-iv-rapid-fire-bank-prep-plan",
        title: "PART IV — RAPID-FIRE BANK & PREP PLAN",
        intro: "Part lead-in.\n\n## 41. Rapid-fire questions\n\nRapid-fire lead-in.",
      },
    ]);
    expect(got.extras).toEqual([{ key: "42-cheat-sheets", title: "42. Cheat sheets", body: "### Numbers\n\ntable" }]);
    expect(got.unaccounted).toEqual([]);
  });

  it("a part keeps its lead-in and source-section prose (headings included) as its intro", () => {
    const src = md(
      "# Part 4 — Design", "", "*Italic part intro.*", "",
      "## Design prompts", "", "For each, structure your answer.", "",
      "**1. Design a URL shortener.**", "Key generation.", "",
      "## Behavioural", "", '- **"Tell me about an incident."** What broke.', "", "---", "",
      "# Part 5 — Rapid-fire", "",
      "## Q1. Default status?", "", "201",
    );
    const got = parseBook(src, "nest");
    expect(got.questions.map((q) => [q.part, q.question])).toEqual([
      ["Part 4 — Design", "Design a URL shortener"],
      ["Part 4 — Design", "Tell me about an incident."],
      ["Part 5 — Rapid-fire", "Default status?"],
    ]);
    expect(got.parts.map((p) => p.intro)).toEqual([
      "*Italic part intro.*\n\n## Design prompts\n\nFor each, structure your answer.\n\n## Behavioural",
      "",
    ]);
    expect(got.unaccounted).toEqual([]);
  });

  it("every line outside a kept range is reported as unaccounted with its 1-based line", () => {
    const src = md(
      "# Book", "",
      "# Part 1 — Basics", "",
      "## Q1. A?", "", "One.", "",
      "# Glossary", "", "Words.", "",
      "### Stray notes", "", "Text.",
    );
    expect(parseBook(src, "bk").unaccounted).toEqual([
      { line: 9, heading: "# Glossary" },
      { line: 11, heading: "Words." },
      { line: 13, heading: "### Stray notes" },
      { line: 15, heading: "Text." },
    ]);
  });

  it("a stray section inside a part is unaccounted, not folded into the part intro", () => {
    const src = md(
      "# Part 1 — Basics", "", "Lead.", "",
      "## Q1. A?", "", "One.", "",
      "## Notes", "", "Stray paragraph.", "", "---", "",
      "## Q2. B?", "", "Two.",
    );
    const got = parseBook(src, "bk");
    expect(got.parts[0].intro).toBe("Lead.");
    expect(got.unaccounted).toEqual([
      { line: 9, heading: "## Notes" },
      { line: 11, heading: "Stray paragraph." },
    ]);
  });

  it("CRLF input gives the same result as LF", () => {
    expect(parseBook(book.replace(/\n/g, "\r\n"), "css")).toEqual(parseBook(book, "css"));
  });
});

describe("parseBook — canonical (pulled) format", () => {
  const canonical = md(
    "<!-- learn:book id=6710a1b2c3d4e5f6a7b8c9d0 -->",
    "# The React Question Book",
    "",
    "How to read this.",
    "",
    "<!-- learn:part key=part-1-fundamentals -->",
    "# Part 1 — Fundamentals",
    "",
    "*Part lead-in.*",
    "",
    "## Design prompts",
    "",
    "**1. Not a question here.**",
    "",
    "<!-- learn:question id=6710a1b2c3d4e5f6a7b8c9d1 -->",
    "## Q1. What is React?",
    "",
    "<!-- learn:answer -->",
    "A UI library.",
    "",
    "#### Detail",
    "",
    "More.",
    "",
    "<!-- learn:question id=6710a1b2c3d4e5f6a7b8c9d2 -->",
    "## Q2. What does this print?",
    "",
    "```js",
    "<!-- learn:answer -->",
    "console.log(1);",
    "```",
    "",
    "<!-- learn:answer -->",
    "`1`.",
    "",
    "<!-- learn:part key=part-2-hooks -->",
    "# Part 2 — Hooks",
    "",
    "<!-- learn:question -->",
    "## Q3. What is a hook?",
    "",
    "<!-- learn:answer -->",
    "A function.",
    "",
    "<!-- learn:extra key=appendix-a-10-day-study-plan -->",
    "## Appendix — A 10-day study plan",
    "",
    "Day 1.",
    "",
    "## Final note",
    "",
    "Good luck.",
  );

  it("uses the markers for ids, parts, extras and the prompt/answer split", () => {
    const got = parseBook(canonical, "react-questions-ebook");
    expect(got.id).toBe("6710a1b2c3d4e5f6a7b8c9d0");
    expect(got.title).toBe("The React Question Book");
    expect(got.intro).toBe("How to read this.");
    expect(got.parts).toEqual([
      {
        key: "part-1-fundamentals",
        title: "Part 1 — Fundamentals",
        intro: "*Part lead-in.*\n\n## Design prompts\n\n**1. Not a question here.**",
      },
      { key: "part-2-hooks", title: "Part 2 — Hooks", intro: "" },
    ]);
    expect(got.questions).toEqual([
      {
        id: "6710a1b2c3d4e5f6a7b8c9d1",
        question: "What is React?",
        part: "Part 1 — Fundamentals",
        partKey: "part-1-fundamentals",
        prompt: "",
        answer: "A UI library.\n\n#### Detail\n\nMore.",
        importKey: importKey("react-questions-ebook", "What is React?", ""),
      },
      {
        id: "6710a1b2c3d4e5f6a7b8c9d2",
        question: "What does this print?",
        part: "Part 1 — Fundamentals",
        partKey: "part-1-fundamentals",
        prompt: "```js\n<!-- learn:answer -->\nconsole.log(1);\n```",
        answer: "`1`.",
        importKey: importKey("react-questions-ebook", "What does this print?", "```js\n<!-- learn:answer -->\nconsole.log(1);\n```"),
      },
      {
        question: "What is a hook?",
        part: "Part 2 — Hooks",
        partKey: "part-2-hooks",
        prompt: "",
        answer: "A function.",
        importKey: importKey("react-questions-ebook", "What is a hook?", ""),
      },
    ]);
    expect(got.extras).toEqual([
      {
        key: "appendix-a-10-day-study-plan",
        title: "Appendix — A 10-day study plan",
        body: "Day 1.\n\n## Final note\n\nGood luck.",
      },
    ]);
    expect(got.unaccounted).toEqual([]);
  });

  it("an empty Q title becomes the puzzle question, as in legacy books", () => {
    const src = md(
      "<!-- learn:book -->", "# Book", "", "<!-- learn:question -->", "### Q61.", "",
      "```js", "a()", "```", "", "<!-- learn:answer -->", "1",
    );
    expect(records(src)).toEqual([
      { question: "What does this code output?", part: "", prompt: "```js\na()\n```", answer: "1" },
    ]);
  });

  it("content and headings before the book marker are unaccounted", () => {
    const src = md("# Stray title", "", "Stray text.", "", "<!-- learn:book -->", "# Book", "", "Intro.");
    const got = parseBook(src, "bk");
    expect(got.title).toBe("Book");
    expect(got.intro).toBe("Intro.");
    expect(got.unaccounted).toEqual([
      { line: 1, heading: "# Stray title" },
      { line: 3, heading: "Stray text." },
    ]);
  });

  it("a second answer marker in one question is unaccounted, not answer text", () => {
    const src = md(
      "<!-- learn:book -->", "# Book", "", "<!-- learn:question -->", "## Q1. A?", "",
      "<!-- learn:answer -->", "One.", "", "<!-- learn:answer -->", "Two.",
    );
    const got = parseBook(src, "bk");
    expect(got.questions[0].answer).toBe("One.\n\nTwo.");
    expect(got.unaccounted).toEqual([{ line: 10, heading: "<!-- learn:answer -->" }]);
  });

  it("CRLF input gives the same result as LF", () => {
    expect(parseBook(canonical.replace(/\n/g, "\r\n"), "bk")).toEqual(parseBook(canonical, "bk"));
  });

  it("a leading byte-order mark is ignored", () => {
    expect(parseBook(`﻿${canonical}`, "bk")).toEqual(parseBook(canonical, "bk"));
  });

  it("questions keep the key of their own part when two parts share a title", () => {
    const src = md(
      "<!-- learn:book -->", "# Book", "",
      "<!-- learn:part key=misc-a -->", "# Misc", "", "<!-- learn:question -->", "## Q1. A?", "", "<!-- learn:answer -->", "a",
      "<!-- learn:part key=misc-b -->", "# Misc", "", "<!-- learn:question -->", "## Q2. B?", "", "<!-- learn:answer -->", "b",
    );
    expect(parseBook(src, "bk").questions.map((q) => [q.question, q.partKey])).toEqual([
      ["A?", "misc-a"],
      ["B?", "misc-b"],
    ]);
  });
});
