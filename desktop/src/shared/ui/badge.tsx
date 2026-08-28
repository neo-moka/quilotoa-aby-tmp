import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

/**
 * Deliberately not HeroUI's `Badge`, which is a different component: an
 * indicator positioned over an anchor element (`Badge.Anchor`) for notification
 * counts and status dots. Its base is sized and shaped for that job —
 * `min-h-7 min-w-7 rounded-3xl`, a `1px` ring in `--background` with
 * `background-clip: padding-box` to punch it out of the anchor, and
 * `--top-right`/`--bottom-left` placement variants that go `position: absolute`
 * (`@heroui/styles/dist/components/badge.css`). This Badge is a standalone
 * inline label, for which HeroUI's own docs redirect to `Chip`.
 *
 * `Chip` was re-evaluated against the installed `chip.css` and rejected again,
 * now with the ledger written out. `.chip` declares thirteen properties. The
 * brand pill below contradicts ten of them — `rounded-2xl`→`rounded-full`,
 * `py-0.5`→asymmetric optical padding, `text-xs`→`text-2xs`,
 * `leading-5`→`leading-none`, `font-medium`→`font-semibold`, and
 * `--chip-bg`/`--chip-fg` → seven Tailwind variants — then adds `uppercase` and
 * the wide tracking on top. Of the three left, `w-fit` is a no-op on an
 * inline-flex box and the other two are actively wrong here:
 *
 * - `gap-0.5` would land on every badge, but call sites declare their own gap
 *   when they want one (`gap-1` in `ManagedAgentRow`, `gap-1.5` in
 *   `ManagedAgentSessionPanel`), so it would silently widen every icon badge.
 * - `shrink-0` is likewise opt-in today (`ChannelBrowserDialog`,
 *   `MentionAutocomplete`, `ChannelTemplatesSettingsCard`); baking it in would
 *   freeze the badges that are meant to give way in a tight flex row.
 *
 * `ChipRoot` also wraps a string child in a nested `<span class="chip__label">`
 * carrying `px-0.5`, which changes the pill's metrics everywhere and puts an
 * element between the root and its text — the root is where
 * `MentionAutocomplete` hangs `max-w-24 truncate`. And `Chip`'s colour set
 * (`accent`/`success`/`warning`/`danger`/`default`) has no member for the
 * `outline`, `info` and `secondary` roles used here.
 *
 * So adopting `Chip` is a full override plus three neutralisations plus a DOM
 * node to work around: the CSS changes owner and nothing else changes. Kept.
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
