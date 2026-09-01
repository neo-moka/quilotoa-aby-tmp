import * as React from "react";

import { useAgentGraphPanel } from "./agentGraphPanelStore";

const LazyAgentGraphFloatingPanel = React.lazy(async () => {
  const module = await import("./AgentGraphFloatingPanel");
  return { default: module.AgentGraphFloatingPanel };
});

/**
 * Mounts the floating agent-graph panel only once it has been opened, so the
 * graph bundle stays out of the shell's initial load.
 */
export function AgentGraphFloatingPanelHost() {
  const { isOpen } = useAgentGraphPanel();
  if (!isOpen) return null;
  return (
    <React.Suspense fallback={null}>
      <LazyAgentGraphFloatingPanel />
    </React.Suspense>
  );
}
