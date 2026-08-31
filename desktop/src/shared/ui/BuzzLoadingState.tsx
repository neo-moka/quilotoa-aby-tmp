import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

/**
 * Centered, low-emphasis loading state for page and panel fetches.
 *
 * A conventional spinner, not the bee wing-flap: the same direct feedback
 * that replaced the boot gate's animation (see `AppLoadingGate`) applies
 * everywhere something is loading — a spinner reads as "loading" instantly,
 * the mascot read as decoration.
 */
export function BuzzLoadingState({
  className,
  fill = false,
  label = "Loading",
}: {
  className?: string;
  fill?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center text-muted-foreground/45",
        fill ? "min-h-0 flex-1" : "min-h-[calc(100dvh-7rem)]",
        className,
      )}
      data-testid="buzz-loading-state"
      role="status"
    >
      <Spinner aria-label={label} className="h-6 w-6 border-2" />
    </div>
  );
}
