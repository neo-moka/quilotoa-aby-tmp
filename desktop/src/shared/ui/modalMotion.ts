// React Aria (which HeroUI v3 overlays are built on) exposes overlay lifecycle
// as `data-entering` / `data-exiting`, not Radix's `data-state="open|closed"`.
// These classes are therefore rewritten rather than ported.
//
// The exit leg MUST stay at 150ms: React Aria keeps the overlay mounted until
// its CSS animation finishes, and `MODAL_EXIT_ANIMATION_MS` in
// `deferredModalOpen.ts` schedules the remount of lazily-loaded modals against
// that same number. Drift between the two shows up as a flash on close.
export const MODAL_OVERLAY_MOTION_CLASS =
  "transition-none duration-200 ease-out data-[exiting]:duration-150 data-[entering]:animate-in data-[entering]:fade-in-0 data-[exiting]:animate-out data-[exiting]:fade-out-0 motion-reduce:animate-none";

export const MODAL_CONTENT_MOTION_CLASS =
  "origin-center transition-none duration-200 ease-out data-[exiting]:duration-150 data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95 motion-reduce:animate-none";
