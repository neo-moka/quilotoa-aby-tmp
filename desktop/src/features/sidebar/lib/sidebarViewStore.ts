import * as React from "react";

/** Which slice of the sidebar the segmented control is showing. */
export type SidebarView = "now" | "rooms" | "people";

/** Tab order and copy, exported so the control and its tests share one list. */
export const SIDEBAR_VIEWS: readonly { id: SidebarView; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "rooms", label: "Rooms" },
  { id: "people", label: "People" },
];

const DEFAULT_VIEW: SidebarView = "now";

/**
 * Selected sidebar view.
 *
 * A module store rather than a URL param on purpose. The sidebar is chrome: it
 * stays put while the main pane navigates, so encoding its filter in the route
 * would mean every channel link either carries the sidebar's state or silently
 * resets it. It is also not a preference worth persisting — "Rooms" is a
 * momentary narrowing, and restoring it days later would hide the Live and
 * Needs-you blocks with no visible cause.
 *
 * Community-scoped in the sense that a switch should return the reader to the
 * default overview rather than to a filter chosen for the community they left
 * — hence {@link resetSidebarViewStore}, wired into `resetCommunityState`.
 */
let snapshot: SidebarView = DEFAULT_VIEW;
const listeners = new Set<() => void>();

function publish(next: SidebarView) {
  if (snapshot === next) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Imperative read, for tests and non-React callers. */
export function getSidebarViewSnapshot(): SidebarView {
  return snapshot;
}

export function setSidebarView(view: SidebarView): void {
  publish(view);
}

export function subscribeSidebarView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe to the selected view. `AppSidebar` reads this to decide which
 * lists to render; the section components read it to decide whether they
 * belong on screen at all.
 */
export function useSidebarView(): SidebarView {
  return React.useSyncExternalStore(
    subscribeSidebarView,
    getSidebarViewSnapshot,
    getSidebarViewSnapshot,
  );
}

/** Community-scoped reset — wire into `resetCommunityState`. */
export function resetSidebarViewStore(): void {
  snapshot = DEFAULT_VIEW;
  for (const listener of listeners) listener();
}
