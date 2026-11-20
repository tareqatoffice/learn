export type CheckRow = { name: string; passed: boolean; detail: string };

export type GroupProgress = Record<string, CheckRow[]>;

export type CodingProgress = Record<string, GroupProgress>;

export const countPassed = (group: GroupProgress | undefined): number =>
  Object.values(group ?? {}).reduce((sum, rows) => sum + rows.filter((row) => row.passed).length, 0);
