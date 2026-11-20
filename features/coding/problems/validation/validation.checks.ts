import { eq } from "../harness";
import type { Group } from "../harness";
import { isEmail, isLuhn, isUuid, validate } from "./validation";

export const validation: Group = {
  slug: "validation",
  title: "Validation",
  level: "Intermediate",
  questions: [
    {
      name: "isEmail",
      checks: [
        eq("Accepts an address", () => isEmail("a.b@example.co"), true),
        eq("Rejects two @", () => isEmail("a@b@c.io"), false),
        eq("Rejects no dot and spaces", () => [isEmail("a@b"), isEmail("a b@c.io")], [false, false]),
      ],
    },
    {
      name: "isUuid",
      checks: [
        eq("Accepts a UUID", () => isUuid("123e4567-e89b-12d3-a456-426614174000"), true),
        eq("Accepts upper case", () => isUuid("123E4567-E89B-12D3-A456-426614174000"), true),
        eq("Rejects bad groups", () => isUuid("123e4567-e89b-12d3-a456-42661417400"), false),
      ],
    },
    {
      name: "isLuhn",
      checks: [
        eq("Accepts a valid number", () => isLuhn("4539 1488 0343 6467"), true),
        eq("Rejects a bad checksum", () => isLuhn("8273 1232 7352 0569"), false),
        eq("Rejects letters", () => isLuhn("12a4"), false),
      ],
    },
    {
      name: "validate",
      checks: [
        eq("Reports required", () => validate({}, { name: { required: true } }), { name: "required" }),
        eq("Reports the first failing rule", () => validate({ a: "x" }, { a: { minLength: 2, pattern: /y/ } }), { a: "minLength" }),
        eq("Reports pattern", () => validate({ a: "xx" }, { a: { pattern: /y/ } }), { a: "pattern" }),
        eq("Optional blanks pass", () => validate({ a: "" }, { a: { minLength: 2 } }), {}),
      ],
    },
  ],
};
