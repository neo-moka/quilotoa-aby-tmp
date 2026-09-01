import * as React from "react";

/**
 * Open/maximized state for the floating agent-graph panel.
 *
 * Window chrome, like the right dock's open state: it holds no
 * community-scoped data (the graph content itself remounts with the
 * community subtree), so it deliberately survives community switches and
 * needs no entry in `resetCommunityState`.
 */
type AgentGraphPanelSnapshot = {
  isOpen: boolean;
  isMaximized: boolean;
};

let snapshot: AgentGraphPanelSnapshot = { isOpen: false, isMaximized: false };
const listeners = new Set<() => void>();

function publish(next: Partial<AgentGraphPanelSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

export function openAgentGraphPanel() {
  if (!snapshot.isOpen) publish({ isOpen: true });
}

export function closeAgentGraphPanel() {
  if (snapshot.isOpen) publish({ isOpen: false });
}

export function toggleAgentGraphPanel() {
  publish({ isOpen: !snapshot.isOpen });
}

export function toggleAgentGraphPanelMaximized() {
  publish({ isMaximized: !snapshot.isMaximized });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AgentGraphPanelSnapshot {
  return snapshot;
}

export function useAgentGraphPanel(): AgentGraphPanelSnapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot);
}
