import { cn } from "@/lib/utils";

export function chipClass(on: boolean, className?: string) {
  return cn(
    "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-left text-sm break-words transition-colors pointer-coarse:px-3.5 pointer-coarse:py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground hover:bg-muted",
    className,
  );
}

export function Chip({
  on,
  onClick,
  disabled,
  children,
  className,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled} className={chipClass(on, className)}>
      {children}
    </button>
  );
}

export function Tab({
  selected,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type"> & { selected: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={chipClass(selected, className)}
      {...props}
    >
      {children}
    </button>
  );
}
