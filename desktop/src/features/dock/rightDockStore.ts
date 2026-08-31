import * as React from "react";

/**
 * Chrome state for the app-level right dock.
 *
 * The dock is a standing column beside the content card — on every screen,
 * not just channels — whose body is picked from a small view registry
 * (`rightDockViews.tsx`). Today that registry holds one view, agent activity,
 * which is also the default; future content types (docs, pinned artifacts,
 * notifications…) add a registry entry and call `openRightDock(theirId)`
 * without touching this store.
 *
 * A module store for the same reason as `terminalPanelStore`: the dock is
 * toggled from the title bar and from feature surfaces, and must survive
 * navigation between screens. It is deliberately NOT community-scoped — the
 * dock is window chrome like the sidebar; what is community-scoped is each
 * view's own content state (e.g. the agent-activity selection, which resets
 * via `resetCommunityState`).
 */

export type RightDockViewId = "agent-activity";

export const DEFAULT_RIGHT_DOCK_VIEW: RightDockViewId = "agent-activity";

type Snapshot = {
  open: boolean;
  viewId: RightDockViewId;
};

// Open by default: ambient agent activity is the dock's resting state.
let snapshot: Snapshot = { open: true, viewId: DEFAULT_RIGHT_DOCK_VIEW };
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  if (snapshot.open === next.open && snapshot.viewId === next.viewId) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Open the dock, optionally switching which registered view it shows. */
export function openRightDock(viewId?: RightDockViewId) {
  publish({ open: true, viewId: viewId ?? snapshot.viewId });
}

export function closeRightDock() {
  publish({ ...snapshot, open: false });
}

/**
 * Toggle from a trigger. When a `viewId` is given and the dock is already
 * open on a different view, this switches views instead of closing — the
 * caller asked for that content, not for dismissal.
 */
export function toggleRightDock(viewId?: RightDockViewId) {
  if (snapshot.open && (viewId === undefined || viewId === snapshot.viewId)) {
    closeRightDock();
    return;
  }
  openRightDock(viewId);
}

/** Imperative read, for toggles and non-React callers. */
export function getRightDockSnapshot(): Snapshot {
  return snapshot;
}

export function useRightDock(): Snapshot {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function resetRightDockForTests() {
  snapshot = { open: true, viewId: DEFAULT_RIGHT_DOCK_VIEW };
  for (const listener of listeners) listener();
}
