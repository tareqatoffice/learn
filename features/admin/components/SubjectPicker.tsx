"use client";

import { Chip } from "@/components/Chip";

export function SubjectPicker({
  options,
  value,
  onChange,
}: {
  options: { slug: string; name: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  return (
    <div role="group" aria-label="Subjects" className="flex flex-wrap gap-2">
      {options.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet.</p>}
      {options.map((o) => (
        <Chip key={o.slug} on={value.includes(o.slug)} onClick={() => toggle(o.slug)}>
          {o.name}
        </Chip>
      ))}
    </div>
  );
}
