// React Aria drives popover lifecycle with `data-entering` / `data-exiting` and
// reports its resolved side as `data-placement`, where Radix used
// `data-state="open|closed"` and `data-side`.
//
// These live here rather than in `popoverSurface.ts` on purpose: that module
// still serves `dropdown-menu.tsx`, `context-menu.tsx` and the three
// autocomplete surfaces, which are all still on Radix. Its
// `POPOVER_RADIX_*_MOTION_CLASS` exports must keep working until those migrate.
export const POPOVER_ARIA_MOTION_CLASS =
  "duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-[exiting]:duration-100 data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95 motion-reduce:animate-none";

export const POPOVER_ARIA_SIDE_MOTION_CLASS =
  "data-[placement=bottom]:slide-in-from-top-1 data-[placement=left]:slide-in-from-right-1 data-[placement=right]:slide-in-from-left-1 data-[placement=top]:slide-in-from-bottom-1";
