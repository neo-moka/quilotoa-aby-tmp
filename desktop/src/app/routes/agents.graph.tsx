import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

const AgentGraphView = React.lazy(async () => {
  const module = await import("@/features/agents/graph/AgentGraphView");
  return { default: module.AgentGraphView };
});

export const Route = createFileRoute("/agents/graph")({
  component: AgentGraphRouteComponent,
});

function AgentGraphRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="agents" />}>
      <AgentGraphView />
    </React.Suspense>
  );
}
