import * as React from "react";

/**
 * Which of the panel's two faces is showing: every agent's run at once, or one
 * agent's transcript.
 */
export type AgentRunPanelView = "runs" | "detail";

/**
 * Runs-list vs run-detail for the agent panel.
 *
 * Deliberately a second store rather than another field on
 * `agentActivityPanelStore`. That one answers *which agent*, and it is written
 * from every surface that can point the panel at somebody — a channel header, an
 * agent card, a deep link. Folding the view into it would make each of those
 * writers settle a navigation question they have no opinion about, and the one
 * that forgot would silently yank a reader out of a transcript they were part
 * way through. Kept apart, picking an agent and picking a face compose instead
 * of colliding.
 *
 * Not route state either, for the reason the selection is not: this panel
 * outlives the route it was opened from, so a per-route back stack would drop
 * the reader back to the list every time they changed channels — the opposite of
 * what a "watch this run" surface is for.
 *
 * The default is `"runs"`, and it stays `"runs"` even when an agent is already
 * selected. This module cannot see the selection, and guessing from one would
 * make the panel's landing state depend on whichever surface last wrote a
 * pubkey. A caller that genuinely arrives with a run in mind — a deep link into
 * one agent's activity — says so by calling `showAgentRunDetail()` at that
 * point.
 *
 * Community-scoped: `resetAgentRunPanelStore` is wired into
 * `resetCommunityState`, so a switch cannot leave the panel showing a detail
 * view whose agent belongs to the community you just left.
 */
let view: AgentRunPanelView = "runs";
const listeners = new Set<() => void>();

function publish(next: AgentRunPanelView) {
  // Re-selecting the face you are already on is a no-op rather than a
  // notification: the back button and the row click both fire on every press,
  // and `useSyncExternalStore` would otherwise re-render every subscriber for a
  // state that did not move.
  if (view === next) return;
  view = next;
  for (const listener of listeners) listener();
}

/** Back out of a transcript to the cross-channel list of runs. */
export function showAgentRunsList() {
  publish("runs");
}

/**
 * Show the selected agent's transcript. Does not select the agent — pair it
 * with `selectAgentActivityAgent`, whose store owns that half.
 */
export function showAgentRunDetail() {
  publish("detail");
}

/** Non-React read, for callers already outside a component and for tests. */
export function getAgentRunPanelView(): AgentRunPanelView {
  return view;
}

export function subscribeAgentRunPanelView(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAgentRunPanelView(): AgentRunPanelView {
  return React.useSyncExternalStore(
    subscribeAgentRunPanelView,
    getAgentRunPanelView,
    getAgentRunPanelView,
  );
}

/**
 * Community-scoped reset — wired into `resetCommunityState`.
 *
 * Notifies unconditionally, unlike `publish`: a reset runs at a moment when the
 * whole community-scoped subtree is being torn down, and a subscriber that
 * happens to already be on `"runs"` still needs the tick to re-read everything
 * else that changed with it.
 */
export function resetAgentRunPanelStore() {
  view = "runs";
  for (const listener of listeners) listener();
}
