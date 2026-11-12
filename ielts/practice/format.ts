// The authoring text for a section's questions, so an admin edits one text box instead of a nested form.
//
//   ## tfng | Do the statements agree with the passage?
//   The earth is flat. => FALSE ~ optional explanation
//
//   ## mcq | Choose the correct letter.
//   What is the main idea? => B
//     A. one
//     B. two
//
//   ## matching | Match each person with an opinion.
//   > A. Opinion one
//   > B. Opinion two
//   Anna => B
//
//   ## completion | Write NO MORE THAN TWO WORDS.
//   The ___ is large. => big | huge ~ optional explanation
//
// Pure: no mongoose or server imports.

import { type Group, QUESTION_KINDS, type Question, type QuestionKind, letter } from "./marking";

export type ParseResult = { ok: true; groups: Group[] } | { ok: false; errors: string[] };

const HEADER = /^##\s*([a-z]+)\s*(?:\|\s*(.*))?$/i;
const OPTION = /^\s+([A-Z])\.\s+(.+)$/;
const GROUP_OPTION = /^>\s*([A-Z])\.\s+(.+)$/;

function splitExplanation(rest: string): { answers: string[]; explanation: string } {
  const at = rest.indexOf("~");
  const answerPart = at === -1 ? rest : rest.slice(0, at);
  const explanation = at === -1 ? "" : rest.slice(at + 1).trim();
  const answers = answerPart.split("|").map((a) => a.trim()).filter(Boolean);
  return { answers, explanation };
}

export function parseQuestions(text: string): ParseResult {
  const errors: string[] = [];
  const groups: Group[] = [];
  let group: Group | null = null;
  let last: Question | null = null;

  text.split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1;
    if (!raw.trim()) return;
    if (raw.trim().startsWith("##")) {
      const header = raw.trim().match(HEADER);
      const kind = header?.[1].toLowerCase() as QuestionKind | undefined;
      if (!kind || !QUESTION_KINDS.includes(kind)) {
        errors.push(`Line ${lineNo}: unknown question type. Use ${QUESTION_KINDS.join(", ")}.`);
        group = null;
        return;
      }
      group = { kind, instruction: (header?.[2] ?? "").trim(), options: [], questions: [] };
      groups.push(group);
      last = null;
      return;
    }
    if (!group) {
      errors.push(`Line ${lineNo}: start a group with "## type | instruction" first.`);
      return;
    }
    const groupOption = raw.trim().match(GROUP_OPTION);
    if (groupOption) {
      if (group.kind !== "matching") errors.push(`Line ${lineNo}: only matching groups have shared options (> A. text).`);
      else if (groupOption[1] !== letter(group.options.length)) errors.push(`Line ${lineNo}: shared options must go A, B, C in order.`);
      else group.options.push(groupOption[2].trim());
      return;
    }
    const option = raw.match(OPTION);
    if (option) {
      if (group.kind !== "mcq" || !last) errors.push(`Line ${lineNo}: indented options belong under a mcq question.`);
      else if (option[1] !== letter(last.options.length)) errors.push(`Line ${lineNo}: options must go A, B, C in order.`);
      else last.options.push(option[2].trim());
      return;
    }
    const arrow = raw.indexOf("=>");
    if (arrow === -1) {
      errors.push(`Line ${lineNo}: write the question, then "=>", then the answer.`);
      return;
    }
    const prompt = raw.slice(0, arrow).trim();
    const { answers, explanation } = splitExplanation(raw.slice(arrow + 2));
    if (!prompt) errors.push(`Line ${lineNo}: the question is empty.`);
    else if (!answers.length) errors.push(`Line ${lineNo}: add the correct answer after "=>".`);
    else {
      last = { n: 0, kind: group.kind, prompt, options: [], answers, explanation };
      group.questions.push(last);
    }
  });

  for (const g of groups) {
    if (!g.questions.length) errors.push(`The ${g.kind} group "${g.instruction || "no instruction"}" has no questions.`);
    if (g.kind === "matching" && g.options.length < 2) errors.push("A matching group needs at least two shared options (> A. text).");
    for (const q of g.questions) {
      if (g.kind === "mcq" && q.options.length < 2) errors.push(`"${q.prompt}" needs at least two options (indented A., B.).`);
      if (g.kind === "mcq" || g.kind === "matching") {
        const count = g.kind === "mcq" ? q.options.length : g.options.length;
        for (const a of q.answers) {
          const i = a.trim().toUpperCase().charCodeAt(0) - 65;
          if (a.trim().length !== 1 || i < 0 || i >= count) errors.push(`"${q.prompt}": answer "${a}" is not one of the option letters.`);
        }
      }
      if (g.kind === "tfng" && !q.answers.every((a) => /^(true|false|not given|t|f|ng)$/i.test(a.trim()))) {
        errors.push(`"${q.prompt}": use TRUE, FALSE or NOT GIVEN.`);
      }
      if (g.kind === "ynng" && !q.answers.every((a) => /^(yes|no|not given|y|n|ng)$/i.test(a.trim()))) {
        errors.push(`"${q.prompt}": use YES, NO or NOT GIVEN.`);
      }
    }
  }
  if (!groups.length && !errors.length) errors.push("Add at least one group of questions.");
  return errors.length ? { ok: false, errors } : { ok: true, groups };
}

/** The inverse of `parseQuestions`, for editing a saved section. */
export function formatQuestions(groups: Group[]): string {
  return groups
    .map((g) => {
      const lines = [`## ${g.kind}${g.instruction ? ` | ${g.instruction}` : ""}`];
      g.options.forEach((o, i) => lines.push(`> ${letter(i)}. ${o}`));
      for (const q of g.questions) {
        lines.push(`${q.prompt} => ${q.answers.join(" | ")}${q.explanation ? ` ~ ${q.explanation}` : ""}`);
        q.options.forEach((o, i) => lines.push(`  ${letter(i)}. ${o}`));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}
