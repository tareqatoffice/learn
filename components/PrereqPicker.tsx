"use client";

import { Chip } from "@/components/Chip";

/** Same-graph topics as toggle chips; the topic being edited is never offered. */
export function PrereqPicker({
  options,
  selfId,
  value,
  onChange,
}: {
  options: { id: string; title: string }[];
  selfId?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const candidates = options.filter((o) => o.id !== selfId);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div role="group" aria-label="Prerequisites" className="flex flex-wrap gap-2">
      {candidates.length === 0 && <p className="text-sm text-muted-foreground">No other topics in this graph yet.</p>}
      {candidates.map((o) => (
        <Chip key={o.id} on={value.includes(o.id)} onClick={() => toggle(o.id)}>
          {o.title}
        </Chip>
      ))}
    </div>
  );
}
