import * as React from "react";

import { GitFork } from "lucide-react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import { openAgentGraphPanel } from "@/features/agents/graph/agentGraphPanelStore";
import { Button } from "@/shared/ui/button";

import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
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
import {
  showAgentRunsList,
  useAgentRunPanelView,
} from "@/features/agents/agentRunPanelStore";
import { resolveActivityAgentPubkey } from "./agentActivitySelection";
import { AgentActivitySettingsMenu } from "./AgentActivitySettingsMenu";
import type { AgentActivityCandidate } from "./AgentActivitySelector";
import { AgentRunDetailHeader } from "./AgentRunDetailHeader";
import { ManagedAgentSessionPanel } from "./ManagedAgentSessionPanel";

const LazyEmbeddedAgentGraph = React.lazy(async () => {
  const module = await import("@/features/agents/graph/AgentGraphView");
  return { default: module.AgentGraphView };
});

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
  closeTestId,
  isSinglePanelView = false,
  layout,
  onClose,
  onResetWidth,
  onResizeStart,
  profiles,
  selectedPubkey,
  splitPaneClamp,
  transparentChrome = false,
  widthPx,
}: {
  canResetWidth?: boolean;
  /** Forwarded to the panel shell — see `AuxiliaryPanelContextValue`. */
  closeTestId?: string;
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
  /** Unused since the graph took over selection; kept so callers need no change. */
  onSelectAgent?: (pubkey: string) => void;
  profiles?: UserProfileLookup;
  selectedPubkey: string | null;
  /**
   * Forwarded to `AuxiliaryPanel`. The right dock passes `false`: its wrapper
   * is sized by the panel, so the shell's `calc(100% - …)` clamp would
   * resolve against the panel itself and squeeze the content to a sliver.
   */
  splitPaneClamp?: boolean;
  transparentChrome?: boolean;
  widthPx: number;
}) {
  const managedAgentsQuery = useManagedAgentsQuery();
  const relayAgentsQuery = useRelayAgentsQuery();
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

  const channelNameById = React.useMemo(
    () =>
      new Map(
        (channelsQuery.data ?? []).map((channel) => [channel.id, channel.name]),
      ),
    [channelsQuery.data],
  );
  const channelNameFor = React.useCallback(
    (channelId: string) => channelNameById.get(channelId) ?? null,
    [channelNameById],
  );

  // Locally managed agents keep their live process status. Relay agents that
  // are not managed from this desktop — including ones owned by someone else —
  // are watchable too: their harnesses may broadcast public observer frames
  // (kind 24201), and encrypted-frame agents simply show no transcript.
  const agents = React.useMemo<AgentActivityCandidate[]>(() => {
    const managed = (managedAgentsQuery.data ?? []).filter(
      isManagedAgentActive,
    );
    const managedPubkeys = new Set(managed.map((agent) => agent.pubkey));
    const relayOnly = (relayAgentsQuery.data ?? [])
      .filter((agent) => !managedPubkeys.has(agent.pubkey))
      .map((agent) => ({
        pubkey: agent.pubkey,
        name: agent.name,
        status: "deployed" as const,
      }));
    return [...managed, ...relayOnly];
  }, [managedAgentsQuery.data, relayAgentsQuery.data]);

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

  const workingCount = agents.filter((agent) =>
    workingPubkeys.has(agent.pubkey),
  ).length;

  const selectedAgent =
    agents.find((agent) => agent.pubkey === resolvedPubkey) ?? null;

  // The picker this replaced could only answer "which agent", never "what is
  // anyone doing" — you had to select an agent to find out it was idle. The
  // runs list answers both at once, so it is the panel's front door and the
  // transcript sits one step behind it.
  //
  // It stays the front door even with a single agent, where the old picker
  // hid itself: one row saying what that agent is doing and where is worth
  // more than a one-option chooser, and `openAgentActivityPanel` already
  // skips straight past it whenever the caller named an agent.
  const panelView = useAgentRunPanelView();
  const showRunsList = panelView === "runs";

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
      closeTestId={closeTestId}
      isSinglePanelView={isSinglePanelView}
      layout={layout}
      splitPaneClamp={splitPaneClamp}
      transparentChrome={transparentChrome}
      header={
        <AuxiliaryPanelHeader>
          <AuxiliaryPanelHeaderGroup>
            {/* The detail view names the agent in its own header, so repeating
                it here would say the same word twice in adjacent rows. */}
            <AuxiliaryPanelTitle>Agent activity</AuxiliaryPanelTitle>
            {/* Working count, not roster count: the chip answers "how much is
                happening", and an idle roster of five would overstate that as
                a permanent 5. Hidden at zero — a `0` next to the title reads
                as a badge that failed to load. */}
            {workingCount > 0 ? (
              <span
                className="rounded-full bg-primary/15 px-1.5 py-0.5 text-2xs font-medium leading-none tabular-nums text-primary"
                data-testid="agent-activity-panel-working-count"
              >
                {workingCount}
              </span>
            ) : null}
          </AuxiliaryPanelHeaderGroup>
          <AuxiliaryPanelHeaderActions>
            <Button
              aria-label="Open agent graph"
              data-testid="agent-activity-open-graph"
              onClick={openAgentGraphPanel}
              size="icon-xs"
              title="Agent graph"
              variant="ghost"
            >
              <GitFork />
            </Button>
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
          // One surface for both states: the graph always holds the left,
          // and the rail beside it is the traffic list — or, once a node is
          // clicked, that agent's transcript. The back arrow returns the rail
          // to traffic without ever hiding the graph.
          <div className="flex min-h-0 flex-1 flex-col">
            <React.Suspense fallback={null}>
              <LazyEmbeddedAgentGraph
                detailPane={
                  !showRunsList && selectedAgent ? (
                    <div
                      className="flex min-h-0 flex-1 flex-col"
                      key={selectedAgent.pubkey}
                    >
                      <AgentRunDetailHeader
                        agentAvatarUrl={selectedAgent.avatarUrl ?? null}
                        agentName={selectedAgent.name}
                        agentPubkey={selectedAgent.pubkey}
                        onBack={showAgentRunsList}
                      />
                      {/* Embedded, not standalone — the panel already draws
                          the chrome; `rawLayout="exclusive"` because a rail
                          has no width for a side-by-side raw view. */}
                      <ManagedAgentSessionPanel
                        agent={selectedAgent}
                        autoTail
                        channelId={null}
                        className="min-h-0 flex-1 rounded-none border-0 bg-transparent px-0 py-2 shadow-none"
                        emptyDescription="This agent has not started a turn yet."
                        panelPadding={false}
                        profiles={profiles}
                        rawLayout="exclusive"
                        showHeader={false}
                        showRaw={showRaw}
                        transcriptContentClassName="px-3"
                      />
                    </div>
                  ) : undefined
                }
                variant="embedded"
              />
            </React.Suspense>
          </div>
        )}
      </AuxiliaryPanelBody>
    </AuxiliaryPanel>
  );
}
