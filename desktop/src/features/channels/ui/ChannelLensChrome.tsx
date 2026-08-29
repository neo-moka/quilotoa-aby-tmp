import type * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * The furniture the three channel lenses share.
 *
 * Work, Threads and Artifacts each answer a different question, but they answer
 * it in the same grammar: a labelled section, a list or an empty state, and —
 * where the product genuinely has nothing behind the design — an honest note
 * saying so. Keeping that grammar in one file is what stops the three tabs from
 * drifting into three slightly different-looking lists.
 */

/** A titled band of a lens, with an optional count and trailing slot. */
export function ChannelLensSection({
  children,
  count,
  description,
  icon: Icon,
  testId,
  title,
  trailing,
}: {
  children: React.ReactNode;
  /** Omit rather than pass 0 — a heading with a zero beside it reads as broken. */
  count?: number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <section className="min-w-0" data-testid={testId}>
      <div className="flex min-w-0 items-center gap-2 pb-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {typeof count === "number" && count > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground/70">
            {count}
          </span>
        ) : null}
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>
      {description ? (
        <p className="pb-2 text-xs text-muted-foreground/80">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

/** A bordered list container — the shared surface every lens row sits in. */
export function ChannelLensList({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60 bg-card/40"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/**
 * Nothing to show, but the lens itself is working.
 *
 * Distinct from {@link ChannelLensSoon}: this says the channel is quiet, that
 * one says the app cannot answer yet. Conflating them teaches readers to
 * distrust every empty list they see.
 *
 * One muted line, no box and no heading — because this is the *ordinary* state,
 * not an exceptional one. In a new community every section of every channel
 * starts here, and the heading/description pair inside a bordered well is
 * built for a full-screen empty state that owns the viewport; repeated five
 * times down a scroll it turns a quiet channel into a column of empty
 * scaffolding, which reads as something failing to load. The section heading
 * above already says which list is empty, so restating it in a larger font is
 * the same sentence twice.
 */
export function ChannelLensEmpty({
  message,
  testId,
}: {
  /** One sentence: what is absent, and what would put something here. */
  message: string;
  testId: string;
}) {
  return (
    <p className="py-1 text-sm text-muted-foreground/80" data-testid={testId}>
      {message}
    </p>
  );
}

/**
 * A part of the design the product cannot back with data yet.
 *
 * Follows `ChannelStatusStripSoon`: muted, non-interactive, and chipped, so it
 * reads as "not yet" rather than as a control that ignores you. The tooltip
 * carries *why* — a reader who knows the relay has no such event stops filing
 * the gap as a bug, and whoever builds it later inherits the reason.
 *
 * The bar for putting one of these on screen: the design promises something
 * specific and its absence would otherwise look like a rendering failure. A
 * feature nobody is expecting needs no placeholder.
 */
export function ChannelLensSoon({
  className,
  detail,
  items,
  testId,
  title,
}: {
  className?: string;
  /** Why it is missing — surfaced on hover, not as body copy. */
  detail: string;
  /** The specific affordances being deferred, listed rather than described. */
  items?: readonly string[];
  testId: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2.5",
        className,
      )}
      data-testid={testId}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-0 cursor-default items-center gap-2">
            <span className="min-w-0 truncate text-sm text-muted-foreground/80">
              {title}
            </span>
            <Badge className="shrink-0" variant="secondary">
              soon
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
      {items && items.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground/60">
          {items.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
