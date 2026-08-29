import * as React from "react";

import {
  showAgentRunDetail,
  showAgentRunsList,
} from "@/features/agents/agentRunPanelStore";

type Snapshot = {
  isOpen: boolean;
  selectedPubkey: string | null;
};

/**
 * Open state for the agent activity panel.
 *
 * A store rather than route state because the panel is opened from more than
 * one screen — the agents view and the channel header today — and must survive
 * navigating between them. Search params are per-route, so a panel opened in a
 * channel would vanish on the way to another channel, which is the opposite of
 * what a "watch this agent work" surface is for. Mirrors
 * `features/terminal/terminalPanelStore.ts`, the app's existing precedent for a
 * panel toggled from several places.
 *
 * `selectedPubkey` is community-scoped, so it is reset on community switch —
 * see `resetCommunityState`. Without that, switching communities would leave
 * the panel pointed at a pubkey from the previous one.
 */
let snapshot: Snapshot = { isOpen: false, selectedPubkey: null };
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
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
  } else {
    showAgentRunsList();
  }
  publish({
    isOpen: true,
    selectedPubkey: pubkey ?? snapshot.selectedPubkey,
  });
}

export function closeAgentActivityPanel() {
  if (!snapshot.isOpen) return;
  publish({ ...snapshot, isOpen: false });
}

/** Toggle from a trigger, preselecting `pubkey` when opening. */
export function toggleAgentActivityPanel(pubkey?: string | null) {
  if (snapshot.isOpen) {
    closeAgentActivityPanel();
    return;
  }
  openAgentActivityPanel(pubkey);
}

export function selectAgentActivityAgent(pubkey: string) {
  if (snapshot.selectedPubkey === pubkey) return;
  publish({ ...snapshot, selectedPubkey: pubkey });
}

export function useAgentActivityPanel(): Snapshot {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** Community-scoped reset — wired into `resetCommunityState`. */
export function resetAgentActivityPanelStore() {
  snapshot = { isOpen: false, selectedPubkey: null };
  for (const listener of listeners) listener();
}
