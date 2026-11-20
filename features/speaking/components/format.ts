export { clock } from "@/lib/format";

export function mins(n: number): string {
  return String(Math.round(n * 10) / 10);
}
