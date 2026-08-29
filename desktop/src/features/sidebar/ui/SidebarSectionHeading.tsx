import type * as React from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The small-caps heading above a Now-section block.
 *
 * Not `SidebarGroupLabel`: that label is a click target for a collapsible
 * channel section and carries its hover and chevron affordances. These blocks
 * do not collapse, so they get a quieter, purely typographic heading — and the
 * distinction is the point, since a heading that looks interactive but is not
 * is the more expensive mistake.
 *
 * The pulsing dot is reserved for blocks describing something happening right
 * now. It is `aria-hidden` because the heading text already says so, and a
 * screen reader announcing a decorative dot adds nothing.
 */
export function SidebarSectionHeading({
  className,
  count,
  label,
  pulse = false,
  testId,
}: {
  className?: string;
  /** Rendered as a chip when present. `0` is shown — absence means "no count". */
  count?: number;
  label: string;
  pulse?: boolean;
  testId?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex h-6 items-center gap-1.5 px-2 text-sidebar-foreground/50",
        className,
      )}
      data-testid={testId}
    >
      {pulse ? (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
        />
      ) : null}
      <span className="text-2xs font-semibold uppercase tracking-[0.16em]">
        {label}
      </span>
      {count === undefined ? null : (
        <span
          className="rounded-full bg-sidebar-border/50 px-1.5 text-3xs font-semibold leading-4 tabular-nums text-sidebar-foreground/70"
          data-testid={testId ? `${testId}-count` : undefined}
        >
          {count}
        </span>
      )}
    </div>
  );
}
