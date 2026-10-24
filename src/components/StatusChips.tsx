"use client";

import { Chip } from "@/components/Chip";
import type { Status } from "@/models/status";

const OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function StatusChips({ value, onChange, disabled }: { value: Status; onChange: (s: Status) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <Chip key={o.value} on={value === o.value} disabled={disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
