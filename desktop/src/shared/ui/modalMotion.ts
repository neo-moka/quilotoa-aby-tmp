// These classes key off Radix's `data-state="open|closed"` because the overlay
// wrappers that consume them (`dialog.tsx`, `alert-dialog.tsx`) are still Radix.
// React Aria reports the same lifecycle as `data-entering` / `data-exiting`, so
// whenever those wrappers move to HeroUI these selectors have to move with them
// — rewriting one without the other silently drops every open/close animation
// while leaving typecheck, lint and build green.
//
// The exit leg MUST stay at 150ms: `MODAL_EXIT_ANIMATION_MS` in
// `deferredModalOpen.ts` schedules the remount of lazily-loaded modals against
// that same number, and drift between the two shows up as a flash on close.
export const MODAL_OVERLAY_MOTION_CLASS =
  "transition-none duration-200 ease-out data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none";

export const MODAL_CONTENT_MOTION_CLASS =
  "origin-center transition-none duration-200 ease-out data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none";
