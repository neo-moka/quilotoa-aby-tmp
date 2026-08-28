import * as React from "react";

import { DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS } from "@/shared/ui/popover";

/**
 * The close delay for a hover-opened popover.
 *
 * The open delay was already shared (`DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS`);
 * the close delay was not, and drifted to four different values across the six
 * sites that hand-rolled this behaviour — 150ms in the reaction pill, 180ms in
 * the channel activity and bot activity popovers, 200ms in `PubKey` and the
 * user profile popover. None of that was deliberate.
 *
 * Migrating sites should pass their current value explicitly so the move is a
 * pure refactor, and converge on this default as a separate, visible decision.
 */
export const DEFAULT_POPOVER_HOVER_CLOSE_DELAY_MS = 200;

export interface UseHoverPopoverOptions {
  /** Milliseconds to wait after pointer enter before opening. */
  openDelay?: number;
  /** Milliseconds to wait after pointer leave before closing. */
  closeDelay?: number;
  /**
   * Suppresses hover opening entirely. The popover can still be opened through
   * the returned `setOpen`, which is what call sites with a click affordance
   * need — a reaction pill with no reactors, or a profile chip whose hover card
   * is switched off, should not open on hover but must stay controllable.
   */
  isDisabled?: boolean;
}

export interface UseHoverPopoverResult {
  /** Current open state, for Radix's `open` prop. */
  open: boolean;
  /** Direct control, for Radix's `onOpenChange` and for imperative closes. */
  setOpen: (open: boolean) => void;
  /**
   * Spread onto the trigger — or onto a wrapper around it when the trigger is
   * `disabled`, since a disabled button emits no pointer events.
   */
  triggerProps: {
    onBlur: () => void;
    onFocus: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /**
   * Spread onto the popover content, so travelling from trigger to panel does
   * not close it.
   */
  contentProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

/**
 * Opens a popover on hover, with the open/close delays that keep it from
 * flickering as the pointer crosses it.
 *
 * Six components had each written this: a pair of timers, a cancel-on-content-
 * enter, and an unmount cleanup. They agreed on the open delay and disagreed on
 * the close delay, and three of them had subtly different focus handling.
 *
 * Deliberately a hook rather than a component. The six call sites do not share
 * a shape — some hang the handlers on `PopoverTrigger`, one on `PopoverAnchor`,
 * and one on a `<span>` wrapping a `disabled` button that cannot emit pointer
 * events itself. A component would have to impose one of those on all of them.
 *
 * Radix stays the engine underneath. React Aria's non-modal popover derives
 * `isDismissable` from its modality and closes on ancestor scroll, which in an
 * auto-scrolling message timeline means the card vanishes whenever a message
 * arrives; see `docs/heroui-migration/component-map.md` §6ter and §6septies.
 *
 * @example
 * const hover = useHoverPopover({ closeDelay: 150 });
 * <Popover open={hover.open} onOpenChange={hover.setOpen}>
 *   <PopoverTrigger asChild>
 *     <button {...hover.triggerProps}>…</button>
 *   </PopoverTrigger>
 *   <PopoverContent {...hover.contentProps}>…</PopoverContent>
 * </Popover>
 */
export function useHoverPopover({
  closeDelay = DEFAULT_POPOVER_HOVER_CLOSE_DELAY_MS,
  isDisabled = false,
  openDelay = DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS,
}: UseHoverPopoverOptions = {}): UseHoverPopoverResult {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A single timer, not one per direction: opening and closing are mutually
  // exclusive, and two refs let a stale open fire after a close was scheduled.
  const scheduleOpen = React.useCallback(() => {
    if (isDisabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), openDelay);
  }, [clearTimer, isDisabled, openDelay]);

  const scheduleClose = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(false), closeDelay);
  }, [clearTimer, closeDelay]);

  // Keyboard focus opens immediately. The delay exists to absorb a pointer
  // passing over on its way somewhere else; a caret that lands here was aimed.
  const openNow = React.useCallback(() => {
    if (isDisabled) return;
    clearTimer();
    setOpen(true);
  }, [clearTimer, isDisabled]);

  React.useEffect(() => clearTimer, [clearTimer]);

  // A disabled popover must not stay open if it was open when it flipped.
  React.useEffect(() => {
    if (isDisabled) {
      clearTimer();
      setOpen(false);
    }
  }, [clearTimer, isDisabled]);

  const setOpenControlled = React.useCallback(
    (next: boolean) => {
      clearTimer();
      setOpen(next);
    },
    [clearTimer],
  );

  const triggerProps = React.useMemo(
    () => ({
      onBlur: scheduleClose,
      onFocus: openNow,
      onMouseEnter: scheduleOpen,
      onMouseLeave: scheduleClose,
    }),
    [openNow, scheduleClose, scheduleOpen],
  );

  const contentProps = React.useMemo(
    () => ({ onMouseEnter: clearTimer, onMouseLeave: scheduleClose }),
    [clearTimer, scheduleClose],
  );

  return { contentProps, open, setOpen: setOpenControlled, triggerProps };
}
