import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/cn";

/**
 * Still Radix. Re-verified against the installed packages rather than the
 * previous summary; the gap is real and narrower than it was written.
 *
 * `skipDelayDuration` has no HeroUI equivalent. HeroUI's `Tooltip` forwards
 * only `delay` and `closeDelay` to React Aria's `useTooltipTriggerState`
 * (react-stately 3.49.0), where the warmup lives in *module-level* state:
 * `globalWarmedUp` is set on every open and cleared by a timeout of
 * `Math.max(TOOLTIP_COOLDOWN, closeDelay)` with `TOOLTIP_COOLDOWN` a hardcoded
 * 500. While it is set, `warmupTooltip()` takes its `showTooltip(true)` branch
 * and the next trigger opens with no dwell at all. No prop reaches that
 * variable, and `closeDelay` can only make the warm window *longer* — so the
 * `delayDuration` / `skipDelayDuration={0}` pair below has no expressible
 * counterpart, and adopting HeroUI would invert the deliberate anti-cascade
 * behaviour across all 86 trigger sites at once. `shouldSkipAnimation` is a
 * different thing: it only restores the fade when one tooltip replaces another.
 *
 * The one remaining path is to drive `isOpen` from this wrapper and
 * re-implement the dwell here — a second timing state machine wrapped around
 * one built for the opposite behaviour, per trigger, also intercepting the
 * focus-open path. Not worth it while Radix expresses the same thing in one
 * prop.
 *
 * Two frictions for the next attempt, both smaller than previously recorded:
 * every one of the 86 `TooltipTrigger` call sites uses Radix's `asChild`, which
 * maps to HeroUI's `render` prop rather than disappearing; and HeroUI's trigger
 * does hardcode `role="button"`, but it spreads caller props *after* it, so a
 * caller-supplied `role` simply wins — nothing has to be stripped.
 *
 * See docs/heroui-migration/component-map.md §7.2.
 */

// Hover-only disclosure should require deliberate pointer dwell. Disabling Radix's
// skip-delay grace prevents tooltips from cascading open while the pointer moves
// across adjacent controls. Callers may override both values for a proven case.
const DEFAULT_TOOLTIP_DELAY_MS = 500;
const DEFAULT_TOOLTIP_SKIP_DELAY_MS = 0;

const TooltipProvider = ({
  delayDuration = DEFAULT_TOOLTIP_DELAY_MS,
  skipDelayDuration = DEFAULT_TOOLTIP_SKIP_DELAY_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
    {...props}
  />
);

const Tooltip = ({
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) => (
  <TooltipPrimitive.Root
    disableHoverableContent={disableHoverableContent}
    {...props}
  />
);

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "pointer-events-none z-50 overflow-hidden rounded-md bg-secondary px-3 py-1.5 text-xs text-secondary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-tooltip-content-transform-origin)",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
