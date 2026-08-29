import { ChevronRight } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/**
 * The one-line answer to "where is this channel at?", between the title and
 * the view tabs.
 *
 * It reads left to right as a sentence: what the channel is for, what is still
 * open, who is working, and what is stuck on you. Each segment hides itself
 * when it has nothing to say, so a quiet channel shows a thin strip or none at
 * all rather than a row of empty scaffolding.
 */
export function ChannelStatusStrip({
  goal,
  onOpenWork,
  runningCount,
  needsYouCount,
}: {
  /**
   * The channel's stated purpose, from its kind:39000 metadata `about`. Not a
   * separate "goal" field: the product has no such concept yet, and inventing
   * a second description would fork the one place a channel already says what
   * it is for.
   */
  goal: string | null;
  onOpenWork: () => void;
  /** Agents mid-turn in this channel right now. */
  runningCount: number;
  /**
   * Items in this channel blocked on the reader — approval requests
   * (kind 46010) and anything else the relay files under `needs_action`.
   * Counted from the same feed Home reads, so the two can never disagree
   * about what is waiting.
   */
  needsYouCount: number;
}) {
  const hasGoal = Boolean(goal?.trim());
  const hasWork = runningCount > 0 || needsYouCount > 0;
  if (!hasGoal && !hasWork) return null;

  return (
    // Chrome only when something is live. A bordered box holding nothing but a
    // line of purpose text reads as an empty input the reader is meant to fill
    // in; the same words unboxed read as a caption, which is what they are.
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        hasWork
          ? "rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1"
          : "px-0.5",
      )}
      data-testid="channel-status-strip"
    >
      {hasGoal ? (
        <p
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          data-testid="channel-status-strip-goal"
          title={goal ?? undefined}
        >
          <span className="font-medium text-foreground">Purpose:</span> {goal}
        </p>
      ) : (
        <span className="min-w-0 flex-1" />
      )}

      {hasWork ? <ChannelDecisionTally /> : null}

      {runningCount > 0 ? (
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="channel-status-strip-running"
          onClick={onOpenWork}
          title="See what the agents are doing"
          type="button"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary"
          />
          {runningCount === 1
            ? "1 agent working"
            : `${runningCount} agents working`}
        </button>
      ) : null}

      {needsYouCount > 0 ? (
        <button
          className="flex shrink-0 items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
          data-testid="channel-status-strip-blocked"
          onClick={onOpenWork}
          title="See what is waiting on you"
          type="button"
        >
          blocked on you
          <ChevronRight aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The decisions tally, drawn empty.
 *
 * Kept in the strip rather than dropped because the shape is the point: three
 * dots and a label is where "two of three settled" will read from, and a
 * reader who never sees the slot has no way to learn the channel will one day
 * answer that question. The dots are all hollow and the count is an em dash —
 * a filled dot here would be a number nobody measured.
 */
function ChannelDecisionTally() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex shrink-0 cursor-default items-center gap-1.5"
          data-testid="channel-status-strip-decisions"
        >
          <span aria-hidden="true" className="flex items-center gap-1">
            <span className="size-1.5 rounded-full ring-1 ring-border ring-inset" />
            <span className="size-1.5 rounded-full ring-1 ring-border ring-inset" />
            <span className="size-1.5 rounded-full ring-1 ring-border ring-inset" />
          </span>
          <span className="text-xs text-muted-foreground/70">— decided</span>
          <SoonBadge />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Buzz cannot yet tell which questions in a channel have been settled.
        When it can, the tally of decisions made against decisions still open
        will fill these dots.
      </TooltipContent>
    </Tooltip>
  );
}

function SoonBadge() {
  return (
    <span className="rounded bg-muted px-1 text-badge uppercase leading-4 tracking-wide text-muted-foreground">
      soon
    </span>
  );
}
