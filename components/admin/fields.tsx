import type { ComponentProps, ReactNode } from "react";
import { inputClass } from "@/components/admin/SaveBar";
import { StatusChips } from "@/components/StatusChips";
import { SubjectPicker } from "@/components/SubjectPicker";
import type { Status } from "@/models/status";

/**
 * Label, control and field error, as used by every admin form. `group` renders a <div> instead of a <label>
 * for controls made of several buttons (chips, pickers), which must not share one label.
 */
export function Field({ label, error, group, children }: { label: string; error?: string; group?: boolean; children: ReactNode }) {
  const message = error && <span className="text-sm text-destructive">{error}</span>;
  if (group) {
    return (
      <div className="grid gap-1">
        <span className="text-sm font-medium">{label}</span>
        {children}
        {message}
      </div>
    );
  }
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {message}
    </label>
  );
}

/** One-line text input with its label and error. */
export function TextField({
  label,
  error,
  value,
  onChange,
  ...rest
}: { label: string; error?: string; value: string; onChange: (value: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  return (
    <Field label={label} error={error}>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function StatusField({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <Field label="Status" group>
      <StatusChips value={value} onChange={onChange} />
    </Field>
  );
}

export function SubjectsField(props: ComponentProps<typeof SubjectPicker>) {
  return (
    <Field label="Subjects" group>
      <SubjectPicker {...props} />
    </Field>
  );
}
