import * as React from "react";

/**
 * Display preference for the Needs-you block: whether plain mentions show.
 *
 * A window preference (like the sidebar's open state), not community-scoped —
 * "I triage mentions elsewhere" is about the reader, not about any one
 * community. Approvals are unaffected; only mention rows are filtered (see
 * `selectNeedsYouRows`).
 */
const STORAGE_KEY = "buzz-sidebar-needs-you-show-mentions.v1";

function readStored(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

let snapshot = readStored();
const listeners = new Set<() => void>();

export function setNeedsYouShowMentions(show: boolean) {
  if (snapshot === show) return;
  snapshot = show;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(show));
  }
  for (const listener of listeners) listener();
}

export function useNeedsYouShowMentions(): boolean {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => true,
  );
}
