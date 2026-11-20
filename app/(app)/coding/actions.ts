"use server";

import { type ActionResult, fail, ok } from "@/admin/result";
import { type QuestionResult, saveCodingResults } from "@/coding/progress";
import { codingResultsInput, shape } from "@/lib/actionInput";
import { requireUser } from "@/lib/authz";

const INVALID = "Those results aren't valid. Reload the page and run the checks again.";

export async function saveCodingResultsAction(input: { group: string; results: QuestionResult[] }): Promise<ActionResult> {
  const user = await requireUser();
  const valid = shape(codingResultsInput, input);
  if (!valid) return fail(INVALID);
  return (await saveCodingResults(user.userId, valid.group, valid.results)) ? ok() : fail(INVALID);
}
