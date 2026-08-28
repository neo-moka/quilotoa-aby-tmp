import {
  ProgressBarFill,
  ProgressBarRoot,
  ProgressBarTrack,
} from "@heroui/react/progress-bar";
import type * as React from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Progress bar on HeroUI (React Aria). `value` is 0–100; a `null`/`undefined`
 * value renders an indeterminate sweep, used for phases with no byte counts
 * (e.g. video transcoding before the upload starts).
 *
 * The indeterminate sweep is an infinite CSS animation, so anything that waits
 * for animations to settle (`waitForAnimations`, screenshot helpers) will hang
 * on a mounted indeterminate bar. That was already true of the hand-rolled
 * version this replaces.
 *
 * `className` styles the bar itself, as before. The fill is no longer the
 * root's direct child — React Aria nests it under a track — so call sites tint
 * it through `fillClassName` rather than the old `[&>div]:` hook.
 */
type ProgressProps = Omit<
  React.ComponentPropsWithoutRef<typeof ProgressBarRoot>,
  "children" | "isIndeterminate" | "value"
> & {
  fillClassName?: string;
  value?: number | null;
};

function Progress({
  className,
  fillClassName,
  value,
  ...props
}: ProgressProps) {
  const clamped =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : null;

  return (
    <ProgressBarRoot
      // `block gap-0` neutralises HeroUI's label/output grid: this bar has
      // neither, and call sites size the root directly.
      className={cn(
        "block h-2 w-full gap-0 overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      isIndeterminate={clamped === null}
      value={clamped ?? undefined}
      {...props}
    >
      <ProgressBarTrack className="h-full w-full rounded-full bg-transparent">
        <ProgressBarFill
          // HeroUI paints the fill with `--accent`, which this app uses as a
          // hover tint rather than its brand colour — see the known gap in
          // shared/styles/globals/heroui.css. Pin it to `--primary` instead.
          className={cn("rounded-full bg-primary", fillClassName)}
        />
      </ProgressBarTrack>
    </ProgressBarRoot>
  );
}

export { Progress };
