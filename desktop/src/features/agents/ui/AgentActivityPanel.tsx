import * as React from "react";
import { X } from "lucide-react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import { useManagedAgentsQuery } from "@/features/agents/hooks";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import type { UserProfileLookup } from "@/features/profile/lib/identity";
import {
  AuxiliaryPanel,
  AuxiliaryPanelBody,
  AuxiliaryPanelHeader,
  AuxiliaryPanelHeaderActions,
  AuxiliaryPanelHeaderGroup,
  AuxiliaryPanelTitle,
} from "@/shared/layout/AuxiliaryPanel";
import { Button } from "@/shared/ui/button";
import { resolveActivityAgentPubkey } from "./agentActivitySelection";
import {
  AgentActivitySelector,
  type AgentActivityCandidate,
} from "./AgentActivitySelector";
import { ManagedAgentSessionPanel } from "./ManagedAgentSessionPanel";

/**
 * Right-side panel for watching one agent work, independent of whatever
 * channel or DM is open.
 *
 * This is deliberately not the channel's `AgentSessionThreadPanel`. That one
 * lives in `features/channels` and is scoped to the thread you are reading, so
 * the agent you watch is whichever agent that thread happens to involve. Here
 * the agent is chosen, and the transcript is passed `channelId={null}` so it
 * follows that agent across every channel it works in.
 *
 * Everything below the selector is the existing transcript surface —
 * `ManagedAgentSessionPanel` already owns the observer subscription, the
 * archive paging, and the shared row grammar of `ActivityRow`. This component
 * is the shell and the picker; it renders none of the transcript itself.
 */
export function AgentActivityPanel({
  canResetWidth,
  onClose,
  onResetWidth,
  onResizeStart,
  onSelectAgent,
  profiles,
  selectedPubkey,
  widthPx,
}: {
  canResetWidth?: boolean;
  onClose: () => void;
  onResetWidth?: () => void;
  onResizeStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSelectAgent: (pubkey: string) => void;
  profiles?: UserProfileLookup;
  selectedPubkey: string | null;
  widthPx: number;
}) {
  const managedAgentsQuery = useManagedAgentsQuery();
  const activeChannelTurns = useActiveAgentTurnsByChannel();

  const agents = React.useMemo<AgentActivityCandidate[]>(
    () => (managedAgentsQuery.data ?? []).filter(isManagedAgentActive),
    [managedAgentsQuery.data],
  );

  // Turns are tracked per channel; the panel is channel-agnostic, so flatten to
  // the set of agents working anywhere right now.
  const workingPubkeys = React.useMemo(
    () =>
      new Set(activeChannelTurns.flatMap((channel) => channel.agentPubkeys)),
    [activeChannelTurns],
  );

  const resolvedPubkey = resolveActivityAgentPubkey({
    agentPubkeys: agents.map((agent) => agent.pubkey),
    selectedPubkey,
    workingPubkeys,
  });

  const selectedAgent =
    agents.find((agent) => agent.pubkey === resolvedPubkey) ?? null;

  return (
    <AuxiliaryPanel
      canResetWidth={canResetWidth}
      header={
        <AuxiliaryPanelHeader>
          <AuxiliaryPanelHeaderGroup>
            <AuxiliaryPanelTitle>Agent activity</AuxiliaryPanelTitle>
          </AuxiliaryPanelHeaderGroup>
          <AuxiliaryPanelHeaderActions>
            <Button
              aria-label="Close agent activity"
              data-testid="agent-activity-panel-close"
              onClick={onClose}
              size="icon-xs"
              variant="ghost"
            >
              <X />
            </Button>
          </AuxiliaryPanelHeaderActions>
        </AuxiliaryPanelHeader>
      }
      onClose={onClose}
      onResetWidth={onResetWidth}
      onResizeStart={onResizeStart}
      resizeHandleAriaLabel="Resize agent activity"
      resizeHandleTestId="agent-activity-panel-resize"
      testId="agent-activity-panel"
      widthPx={widthPx}
    >
      <AuxiliaryPanelBody>
        {agents.length === 0 ? (
          <p
            className="px-4 py-6 text-center text-sm text-muted-foreground"
            data-testid="agent-activity-panel-empty"
          >
            No active agents. Start or deploy an agent to watch it work.
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border px-2 py-2">
              <AgentActivitySelector
                agents={agents}
                onSelect={onSelectAgent}
                selectedPubkey={resolvedPubkey}
                workingPubkeys={workingPubkeys}
              />
            </div>
            {selectedAgent ? (
              <ManagedAgentSessionPanel
                agent={selectedAgent}
                autoTail
                channelId={null}
                className="min-h-0 flex-1"
                emptyDescription="This agent has not started a turn yet."
                key={selectedAgent.pubkey}
                profiles={profiles}
              />
            ) : null}
          </div>
        )}
      </AuxiliaryPanelBody>
    </AuxiliaryPanel>
  );
}
