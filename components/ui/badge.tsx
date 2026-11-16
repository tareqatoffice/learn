import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center rounded-full border font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        muted: "border-border text-muted-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        ok: "border-ok/40 bg-ok/10 text-ok",
        ring: "border-ring/40 bg-ring/10 text-ring",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
        track: "border-track-1/40 bg-track-1/10 text-track-1",
      },
      size: {
        default: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size, className }))} {...props} />
}

export { Badge, badgeVariants }
