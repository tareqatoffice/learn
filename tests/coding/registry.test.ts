import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderCatalog } from "@/scripts/coding-groups";
import { groups } from "@/coding/problems";
import { readGroupSpecs } from "@/coding/specs";

describe("coding test registry", () => {
  it("has unique slugs, and every group page can load its specs", async () => {
    const slugs = groups.map((group) => group.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(await readGroupSpecs(slug), slug).not.toBeNull();
    }
  });

  it("gives every question a spec", async () => {
    for (const group of groups) {
      const specs = await readGroupSpecs(group.slug);
      for (const question of group.questions) {
        expect(question.spec ?? specs?.questions[question.name], `${group.slug}: ${question.name}`).toBeTruthy();
      }
    }
  });

  it("keeps Next.js practice routes inside the sandbox", () => {
    for (const group of groups.filter((g) => g.slug.startsWith("next-"))) {
      for (const question of group.questions) {
        expect(question.href, `${group.slug}: ${question.name}`).toMatch(/^\/(sandbox|api\/sandbox)(\/|$)/);
      }
    }
  });

  it("keeps the generated server catalog in sync (npm run coding:groups)", () => {
    expect(readFileSync(path.join(process.cwd(), "coding", "groups.ts"), "utf8")).toBe(renderCatalog());
  });

  it("returns null for an unknown group", async () => {
    expect(await readGroupSpecs("nope")).toBeNull();
  });
});
