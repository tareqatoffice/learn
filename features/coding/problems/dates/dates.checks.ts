import { addDays, diffInDays, formatDuration, isLeapYear } from "./dates";
import { check, eq } from "../harness";
import type { Group } from "../harness";

export const dates: Group = {
  slug: "dates",
  title: "Dates",
  level: "Intermediate",
  questions: [
    {
      name: "addDays",
      checks: [
        eq("Adds across a month", () => addDays(new Date("2024-01-31T00:00:00Z"), 1).toISOString(), "2024-02-01T00:00:00.000Z"),
        eq("Subtracts", () => addDays(new Date("2024-03-01T00:00:00Z"), -1).toISOString(), "2024-02-29T00:00:00.000Z"),
        check("Does not mutate", () => {
          const date = new Date(0);
          addDays(date, 5);
          return date.getTime() === 0 || "input changed";
        }),
      ],
    },
    {
      name: "diffInDays",
      checks: [
        eq("Counts days", () => diffInDays(new Date("2024-01-01T00:00:00Z"), new Date("2024-01-11T00:00:00Z")), 10),
        eq("Ignores time of day", () => diffInDays(new Date("2024-01-01T23:00:00Z"), new Date("2024-01-02T01:00:00Z")), 1),
        eq("Is negative when b is earlier", () => diffInDays(new Date("2024-01-02T00:00:00Z"), new Date("2024-01-01T00:00:00Z")), -1),
      ],
    },
    {
      name: "isLeapYear",
      checks: [
        eq("2024 is a leap year", () => isLeapYear(2024), true),
        eq("1900 is not", () => isLeapYear(1900), false),
        eq("2000 is", () => isLeapYear(2000), true),
      ],
    },
    {
      name: "formatDuration",
      checks: [
        eq("Under a minute", () => formatDuration(5000), "0:05"),
        eq("Minutes", () => formatDuration(125_900), "2:05"),
        eq("Hours", () => formatDuration(3_725_000), "1:02:05"),
      ],
    },
  ],
};
