import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/cn";

/**
 * Still Radix. HeroUI's `Tooltip` was evaluated for the migration and rejected
 * on one gap that cannot be closed from the outside:
 *
 * `skipDelayDuration` has no equivalent. HeroUI exposes only `delay` and
 * `closeDelay`; the "already warmed up, show the next one instantly" grace is a
 * module-global timer inside React Aria's tooltip state with no prop to disable
 * it — HeroUI's own source acknowledges it ("React Aria sets
 * `shouldSkipAnimation` while its global warmup timer is active"). Adopting
 * HeroUI would therefore invert the deliberate anti-cascade behaviour documented
 * below, across all 56 consumers, and `shouldSkipAnimation` only suppresses the
 * animation — not the warmup that causes the cascade.
 *
 * Two further frictions, both solvable and noted so the next attempt does not
 * re-derive them: every one of the 86 `TooltipTrigger` call sites uses Radix's
 * `asChild`, which maps to HeroUI's `render` prop rather than disappearing; and
 * HeroUI's trigger hardcodes `role="button"` on the element it renders, which a
 * `render` override would have to strip for non-interactive tooltip targets.
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
