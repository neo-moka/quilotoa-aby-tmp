import type * as React from "react";

import {
  selectAgentActivityAgent,
  useAgentActivityPanel,
} from "@/features/agents/agentActivityPanelStore";
import { AgentActivityPanel } from "@/features/agents/ui/AgentActivityPanel";
import { closeRightDock, type RightDockViewId } from "./rightDockStore";

/**
 * Width plumbing every dock view receives — the dock owns one shared
 * resizable width (`useThreadPanelWidth`) so views swap without the column
 * jumping.
 */
export type RightDockViewProps = {
  canResetWidth: boolean;
  onResetWidth: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  widthPx: number;
};

type RightDockViewDefinition = {
  /** Accessible name; a future view picker renders it as the tab label. */
  label: string;
  Component: React.ComponentType<RightDockViewProps>;
};

function AgentActivityDockView(props: RightDockViewProps) {
  const { selectedPubkey } = useAgentActivityPanel();

  return (
    <AgentActivityPanel
      {...props}
      // A dock-specific close test id: screen-local panels keep the shared
      // `auxiliary-panel-close` id unique for the specs written against it.
      closeTestId="right-dock-close"
      onClose={closeRightDock}
      onSelectAgent={selectAgentActivityAgent}
      selectedPubkey={selectedPubkey}
      splitPaneClamp={false}
    />
  );
}

/**
 * The dock's content registry.
 *
 * Adding a future content type is: add its id to `RightDockViewId`
 * (`rightDockStore.ts`), register `{ label, Component }` here, and open it
 * with `openRightDock("your-id")`. The dock chrome, width handling, and
 * enter/exit animation come for free; the component only renders the body.
 */
export const RIGHT_DOCK_VIEWS: Record<
  RightDockViewId,
  RightDockViewDefinition
> = {
  "agent-activity": {
    label: "Agent activity",
    Component: AgentActivityDockView,
  },
};
