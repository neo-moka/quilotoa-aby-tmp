import * as React from "react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import { useManagedAgentsQuery } from "@/features/agents/hooks";
import { useChannelsQuery } from "@/features/channels/hooks";
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
import { resolveActivityAgentPubkey } from "./agentActivitySelection";
import { AgentActivitySettingsMenu } from "./AgentActivitySettingsMenu";
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
  isSinglePanelView = false,
  layout,
  onClose,
  onResetWidth,
  onResizeStart,
  onSelectAgent,
  profiles,
  selectedPubkey,
  transparentChrome = false,
  widthPx,
}: {
  canResetWidth?: boolean;
  isSinglePanelView?: boolean;
  /**
   * Split when the panel sits inside the channel's `RightAuxiliaryPane`, which
   * already draws the surface and the divider. Left at the default the panel
   * paints its own chrome on top of that one and reads as a box inside a
   * panel — the same doubling every sibling in that chain avoids by passing
   * these through.
   */
  layout?: "standalone" | "split";
  onClose: () => void;
  onResetWidth?: () => void;
  onResizeStart?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSelectAgent: (pubkey: string) => void;
  profiles?: UserProfileLookup;
  selectedPubkey: string | null;
  transparentChrome?: boolean;
  widthPx: number;
}) {
  const managedAgentsQuery = useManagedAgentsQuery();
  const activeChannelTurns = useActiveAgentTurnsByChannel();
  const channelsQuery = useChannelsQuery();

  // Raw is view state for one agent, not a device preference like the other two
  // toggles, and the channel panel already resets it when its scope changes.
  // Keying it to the agent keeps that: switching agents starts on the polished
  // transcript rather than inheriting the previous agent's raw view.
  const [rawState, setRawState] = React.useState<{
    pubkey: string | null;
    show: boolean;
  }>({ pubkey: null, show: false });

  const channelNameFor = React.useCallback(
    (channelId: string) =>
      channelsQuery.data?.find((channel) => channel.id === channelId)?.name ??
      null,
    [channelsQuery.data],
  );

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

  const showRaw = rawState.pubkey === resolvedPubkey && rawState.show;
  const activeTurns = React.useMemo(
    () =>
      resolvedPubkey
        ? activeChannelTurns
            .filter((channel) => channel.agentPubkeys.includes(resolvedPubkey))
            .map((channel) => ({
              anchorAt: channel.anchorAt,
              channelId: channel.channelId,
            }))
        : [],
    [activeChannelTurns, resolvedPubkey],
  );

  return (
    <AuxiliaryPanel
      canResetWidth={canResetWidth}
      isSinglePanelView={isSinglePanelView}
      layout={layout}
      transparentChrome={transparentChrome}
      header={
        <AuxiliaryPanelHeader>
          <AuxiliaryPanelHeaderGroup>
            <AuxiliaryPanelTitle>Agent activity</AuxiliaryPanelTitle>
          </AuxiliaryPanelHeaderGroup>
          <AuxiliaryPanelHeaderActions>
            {selectedAgent ? (
              <AgentActivitySettingsMenu
                activeTurns={activeTurns}
                agentName={selectedAgent.name}
                agentPubkey={selectedAgent.pubkey}
                channelNameFor={channelNameFor}
                onShowRawChange={(next) =>
                  setRawState({ pubkey: resolvedPubkey, show: next })
                }
                showRaw={showRaw}
              />
            ) : null}
            {/* No close button here: `AuxiliaryPanelHeaderActions` appends its
                own from the panel's `onClose`, and adding one produced two. */}
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
      {/* `flex flex-col` matters: the body is only `min-h-0 flex-1`, so without
          a column context the transcript's own `flex-1` has nothing to fill and
          the panel does not reach the bottom. */}
      <AuxiliaryPanelBody className="flex flex-col">
        {agents.length === 0 ? (
          <p
            className="px-4 py-6 text-center text-sm text-muted-foreground"
            data-testid="agent-activity-panel-empty"
          >
            No active agents. Start or deploy an agent to watch it work.
          </p>
        ) : (
          <>
            <div className="shrink-0 border-b border-border/60 px-2 py-1.5">
              <AgentActivitySelector
                agents={agents}
                onSelect={onSelectAgent}
                selectedPubkey={resolvedPubkey}
                workingPubkeys={workingPubkeys}
              />
            </div>
            {selectedAgent ? (
              // Flush, not a card. `ManagedAgentSessionPanel` frames itself as
              // a standalone card (`rounded-lg border … shadow-xs`) because its
              // other caller is a preview inside a profile. In a sidebar that
              // reads as a card dropped into a panel, so the frame is dissolved
              // here — `cn` is tailwind-merge backed, so these win.
              <ManagedAgentSessionPanel
                agent={selectedAgent}
                autoTail
                channelId={null}
                className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none"
                emptyDescription="This agent has not started a turn yet."
                key={selectedAgent.pubkey}
                panelPadding={false}
                profiles={profiles}
                showRaw={showRaw}
              />
            ) : null}
          </>
        )}
      </AuxiliaryPanelBody>
    </AuxiliaryPanel>
  );
}
