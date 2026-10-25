import { Button } from "@/components/ui/button";

/** Submit button plus the saved / first-error message shared by the admin forms. */
export function SaveBar({ label, pending, saved, errors }: { label: string; pending: boolean; saved: boolean; errors: Record<string, string> }) {
  const first = Object.entries(errors)[0];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {saved && (
        <span role="status" className="text-sm text-muted-foreground">
          Saved.
        </span>
      )}
      {first && (
        <span role="alert" className="text-sm text-destructive">
          {first[0] === "_" ? first[1] : `${first[0]}: ${first[1]}`}
        </span>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-ring";
