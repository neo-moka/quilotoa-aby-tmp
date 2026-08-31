import * as React from "react";

import {
  showAgentRunDetail,
  showAgentRunsList,
} from "@/features/agents/agentRunPanelStore";
import {
  closeRightDock,
  getRightDockSnapshot,
  openRightDock,
  useRightDock,
} from "@/features/dock/rightDockStore";

/**
 * Agent-activity state for the right dock.
 *
 * The panel's OPEN state now lives in the app-level dock
 * (`features/dock/rightDockStore`): activity is the dock's default view on
 * every screen, not a channel-local pane. This module keeps the
 * content-level state — which agent is selected — plus the open/close/toggle
 * API its many callers already use, now delegating visibility to the dock.
 *
 * `selectedPubkey` is community-scoped, so it is reset on community switch —
 * see `resetCommunityState`. The dock's open state is window chrome (like
 * the sidebar) and deliberately survives the switch.
 */
let selectedPubkey: string | null = null;
const listeners = new Set<() => void>();

function publishSelection(next: string | null) {
  if (selectedPubkey === next) return;
  selectedPubkey = next;
  for (const listener of listeners) listener();
}

/**
 * Open the panel, optionally preselecting an agent.
 *
 * A preselection only applies when one is given: reopening from a surface that
 * has no agent in mind must not clear a choice the user already made.
 */
export function openAgentActivityPanel(pubkey?: string | null) {
  // Which of the panel's two views opens is decided by whether the gesture
  // named an agent. Opening from a channel where somebody is working means
  // "show me that" — the runs list would be an extra click past an answer the
  // caller already had. Opening with nobody in mind means "who is working?",
  // which is the list's question.
  if (pubkey) {
    showAgentRunDetail();
    publishSelection(pubkey);
  } else {
    showAgentRunsList();
  }
  openRightDock("agent-activity");
}

export function closeAgentActivityPanel() {
  closeRightDock();
}

/** Toggle from a trigger, preselecting `pubkey` when opening. */
export function toggleAgentActivityPanel(pubkey?: string | null) {
  if (isAgentActivityOpen()) {
    closeAgentActivityPanel();
    return;
  }
  openAgentActivityPanel(pubkey);
}

export function selectAgentActivityAgent(pubkey: string) {
  publishSelection(pubkey);
}

function useAgentActivitySelection(): string | null {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selectedPubkey,
    () => selectedPubkey,
  );
}

function isAgentActivityOpen(): boolean {
  const dock = getRightDockSnapshot();
  return dock.open && dock.viewId === "agent-activity";
}

export function useAgentActivityPanel(): {
  isOpen: boolean;
  selectedPubkey: string | null;
} {
  const dock = useRightDock();
  const selection = useAgentActivitySelection();
  return React.useMemo(
    () => ({
      isOpen: dock.open && dock.viewId === "agent-activity",
      selectedPubkey: selection,
    }),
    [dock, selection],
  );
}

/** Community-scoped reset — wired into `resetCommunityState`. */
export function resetAgentActivityPanelStore() {
  selectedPubkey = null;
  for (const listener of listeners) listener();
}
