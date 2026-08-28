import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/shared/lib/cn";

/**
 * Still Radix. The call-site cost is *not* the reason — that part is solvable,
 * see the end. The reason is that this wrapper configures four behaviours and
 * React Aria can express two of them.
 *
 * `delayDuration` → `delay` and the close delay → `closeDelay` both map. The
 * other two have no prop, at any layer, in any version installed here:
 *
 * **1. `skipDelayDuration={0}` — the anti-cascade dwell.** HeroUI forwards
 * `delay`/`closeDelay` to React Aria's `useTooltipTriggerState` (react-stately
 * 3.49.0), where the warmup is *module-level* state: `globalWarmedUp` is set on
 * every open and cleared by a timeout of `Math.max(TOOLTIP_COOLDOWN, closeDelay)`
 * — `TOOLTIP_COOLDOWN` a hardcoded 500. While set, `warmupTooltip()` takes its
 * `showTooltip(true)` branch and the next trigger opens with **no dwell**.
 * Nothing reaches that variable and `closeDelay` can only make the window
 * longer. (`shouldSkipAnimation` is unrelated — it only restores the fade.)
 *
 * **2. `disableHoverableContent` — dismissal on leave.** `useTooltip` in
 * react-aria 3.51.0 unconditionally attaches
 * `useHover({ onHoverStart: () => state.open(true), onHoverEnd: … })` to the
 * *tooltip popup*, and RAC's `Tooltip` merges those handlers onto the element
 * (Tooltip.mjs:108,114). `useTooltip(props, state)` takes no flag. React Aria
 * tooltips are hoverable content, always.
 *
 * How much rides on the two that don't map:
 *
 * - **53 of the 86 triggers (62%)** sit in the 18 modules that render two or
 *   more, and the top five are toolbars whose triggers are adjacent siblings:
 *   `ComposerAttachments` 10, `HuddleBar` 5, `NoteCard` 4,
 *   `MessageComposerToolbar` 4, `MessageActionBar` 4 — 27 triggers in five rows,
 *   which is exactly the geometry the warmup turns into a cascade.
 * - **30 call sites re-declare these two props explicitly** even though the
 *   wrapper already defaults them: 25 × `disableHoverableContent` across 10
 *   modules, 5 × `skipDelayDuration={0}` across 4. They are asserted at the
 *   point of use, not passively inherited.
 * - Both are pinned by `tests/e2e/composer-tooltip-dismiss.spec.ts`, a spec file
 *   that exists for nothing else. Its second test is named *"adjacent composer
 *   tooltips each require a fresh dwell"* (hover, wait 400 ms, assert absent,
 *   twice in a row); the other two slide the cursor onto the popup and assert
 *   `toBeHidden()`. Its header names the product consequence of gap 2 — the
 *   tooltip "camping it over the message editor".
 *
 * So the trade is: adopt HeroUI, and 86 triggers lose two behaviours that 30 of
 * them ask for by name, to delete a 20-line wrapper.
 *
 * **The call sites are not the obstacle.** All 86 use Radix's `asChild`, and
 * React Aria has no `Slot` — but RAC ships `Focusable`, and HeroUI's own trigger
 * is already built on `useFocusable`, so this is the lote B `Pressable` pattern
 * (51 `DropdownMenuTrigger` sites) with `Focusable` in its place: one
 * translation, 86 times, mechanical. Recorded so the next attempt does not
 * re-litigate the easy half. Likewise `role="button"` on HeroUI's trigger is
 * hardcoded but spread *before* caller props, so passing `role` overrides it.
 *
 * Count, verified on this branch and on `heroui-integration` and
 * `heroui-lote-f-button`: 86 `TooltipTrigger asChild` across 53 modules, and no
 * `asChild` on `Tooltip` or `TooltipContent` anywhere in `desktop/src`.
 *
 * See docs/heroui-migration/component-map.md §7.2.
 */

// Hover-only disclosure should require deliberate pointer dwell. Disabling Radix's
// skip-delay grace prevents tooltips from cascading open while the pointer moves
// across adjacent controls; 5 call sites re-assert it by name. Callers may
// override both values for a proven case.
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
