import * as React from "react";

/**
 * Registry for the title bar's centered search slot.
 *
 * The global search lives in the sidebar tree (that is where its channels,
 * labels and navigation callbacks are wired) but renders its trigger in the
 * title bar via a portal. A module store rather than `getElementById` because
 * the top chrome mounts and unmounts (settings, huddle rooms): the portal
 * target must track the live element, not a snapshot from first render.
 */
let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** Ref callback for the slot element — registers on mount, clears on unmount. */
export function setTopChromeSearchSlot(node: HTMLElement | null) {
  if (slot === node) return;
  slot = node;
  for (const listener of listeners) listener();
}

/** The current slot element, or `null` while no top chrome is on screen. */
export function useTopChromeSearchSlot(): HTMLElement | null {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => slot,
    () => null,
  );
}
