import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

/**
 * "This agent is working" at the foot of the transcript.
 *
 * A centered arc spinner — the same shape the empty state ("Waiting for ACP
 * activity") uses, so the two loading cues read as one system. It replaced a
 * row of three staggered dots, which sat flush-left at 6px and was easy to
 * miss entirely at the foot of a busy transcript. A liveness cue needs enough
 * presence to be noticed at a glance; centering it in the transcript column
 * and matching the empty-state spinner's size gives it that.
 */
export function TurnLivenessIndicator({ className }: { className?: string }) {
  return (
    <div
      aria-label="Agent turn in progress"
      className={cn(
        "flex w-full items-center justify-center py-2 text-muted-foreground",
        className,
      )}
      data-testid="turn-liveness-indicator"
      role="status"
    >
      <Spinner aria-hidden className="h-7 w-7" />
    </div>
  );
}
