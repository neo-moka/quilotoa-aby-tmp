import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

/**
 * Deliberately not HeroUI's `Badge`, which is a different component: an
 * indicator positioned over an anchor element (`Badge.Anchor`) for notification
 * counts and status dots. This Badge is a standalone inline label, for which
 * HeroUI's own docs redirect to `Chip`.
 *
 * `Chip` was evaluated and rejected: its base is `rounded-2xl px-2 py-0.5
 * text-xs leading-5 font-medium`, and the brand look below overrides every one
 * of those declarations — pill radius, asymmetric optical padding, `text-2xs`,
 * semibold, uppercase, wide tracking. Its colour set (`accent`/`success`/
 * `warning`/`danger`/`default`) also has nothing for the `outline`, `info` and
 * `secondary` roles used here. Adopting it would neutralise the entire
 * component and add a dependency for no styling gained.
 */

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 pb-[3px] pt-[5px] text-2xs font-semibold uppercase leading-none tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline:
          "border border-border/70 bg-background/80 text-muted-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
