// Mongoose-free types shared by the coding pages and the client runner.

export type CheckRow = { name: string; passed: boolean; detail: string };

/** The last results of each question in one group, by question name. */
export type GroupProgress = Record<string, CheckRow[]>;

/** The last results for each group, by group slug. */
export type CodingProgress = Record<string, GroupProgress>;

export const countPassed = (group: GroupProgress | undefined): number =>
  Object.values(group ?? {}).reduce((sum, rows) => sum + rows.filter((row) => row.passed).length, 0);
