import * as React from "react";

import {
  closeAgentActivityPanel,
  selectAgentActivityAgent,
  useAgentActivityPanel,
} from "@/features/agents/agentActivityPanelStore";
import { AgentActivityPanel } from "@/features/agents/ui/AgentActivityPanel";
import { AgentActivityRail } from "@/features/agents/ui/AgentActivityRail";
import {
  setChannelViewTab,
  useChannelViewTab,
} from "@/features/channels/channelViewTabStore";
import { RightAuxiliaryPane } from "@/features/channels/ui/RightAuxiliaryPane";
import { ChannelArtifactsTab } from "@/features/channels/ui/ChannelArtifactsTab";
import type { ChannelPane } from "@/features/channels/ui/ChannelScreenLazyViews";
import { ChannelThreadsTab } from "@/features/channels/ui/ChannelThreadsTab";
import { ChannelWorkTab } from "@/features/channels/ui/ChannelWorkTab";
import type { BotActivityAgent } from "@/features/channels/ui/BotActivityBar";
import { useChannelPaneMessages } from "@/features/channels/ui/useChannelPaneMessages";
import type { TimelineMessage } from "@/features/messages/types";
import { useIsThreadPanelOverlay } from "@/shared/hooks/use-mobile";
import { channelChrome } from "@/shared/layout/chromeLayout";
import { cn } from "@/shared/lib/cn";

/**
 * Exactly what `ChannelPane` takes.
 *
 * Written as `ComponentProps` of the pane rather than as its own shape because
 * the two are swapped for each other behind `GuardedChannelPane`: anything the
 * pane grows, this view has to accept, and spelling the type out a second time
 * would let the two drift until the swap stops typechecking at the call site
 * instead of here.
 */
export type ChannelLensViewProps = React.ComponentProps<typeof ChannelPane>;

/**
 * A channel seen through something other than its conversation.
 *
 * `ChannelPane` renders the channel as a timeline plus a composer. This renders
 * the same channel as Work, Threads or Artifacts — the same events, indexed by
 * a different question. It stands beside the pane rather than inside it because
 * the two share nothing below the header: no composer, no thread panel, no
 * auxiliary column, no scroll anchoring. Folding the lenses into the pane would
 * mean guarding most of it on a tab it does not otherwise care about.
 *
 * What the two *do* share is the header, and that has to stay structurally
 * identical. The header measures itself into
 * `--buzz-channel-content-top-padding` and then pulls itself out of flow with a
 * matching negative margin, so content below it clears the header only because
 * it opts into that padding. A lens that laid its header out differently would
 * render its first row underneath the tab bar — and, worse, would leave a stale
 * measurement behind for the conversation to inherit on the way back.
 */
export const ChannelLensView = React.memo(function ChannelLensView(
  props: ChannelLensViewProps,
) {
  const {
    activeChannel,
    activityAgents,
    agentSessionAgents,
    canResetThreadPanelWidth,
    currentPubkey,
    header,
    isSinglePanelView = false,
    isTimelineLoading,
    messages,
    onOpenAgentSession,
    onOpenThread,
    onResetThreadPanelWidth,
    onThreadPanelResizeStart,
    profiles,
    threadPanelWidthPx,
    threadSummaries,
  } = props;

  const channelId = activeChannel?.id ?? null;
  const tab = useChannelViewTab(channelId);
  // The lens keeps the conversation's right edge: the activity panel when it
  // is open, the agent rail otherwise. Without this, switching to Work or
  // Threads made every agent vanish and turned the header's activity toggle
  // into a button that appears to do nothing.
  const agentActivityPanel = useAgentActivityPanel();
  const isOverlay = useIsThreadPanelOverlay();
  // Same split-mode rule as the conversation's right slot: on narrow layouts
  // there is no width to spare for a rail or a panel.
  const showRightRail = !isSinglePanelView && !isOverlay;
  const { mainTimelineEntries, visibleMessages } = useChannelPaneMessages({
    activeChannel,
    isHuddleTranscript: false,
    messages,
    profiles,
    threadSummaries,
  });

  const workAgents = React.useMemo(
    () => mergeAgentsByPubkey(activityAgents, agentSessionAgents),
    [activityAgents, agentSessionAgents],
  );

  const agentPubkeys = React.useMemo(
    () => new Set(workAgents.map((agent) => agent.pubkey.toLowerCase())),
    [workAgents],
  );

  /**
   * A thread, a diff and an attachment are all read in the conversation — no
   * lens hosts a reading surface of its own. So opening one returns to the
   * conversation with it open, which is also what makes the row feel like a
   * link to somewhere rather than a control that quietly did something
   * off-screen.
   */
  const handleOpenInConversation = React.useCallback(
    (message: TimelineMessage) => {
      if (channelId) setChannelViewTab(channelId, "all");
      onOpenThread(message);
    },
    [channelId, onOpenThread],
  );

  const body =
    tab === "work" ? (
      <ChannelWorkTab
        activeChannel={activeChannel}
        agents={workAgents}
        currentPubkey={currentPubkey}
        onOpenAgentSession={onOpenAgentSession}
        profiles={profiles}
      />
    ) : tab === "threads" ? (
      <ChannelThreadsTab
        agentPubkeys={agentPubkeys}
        entries={mainTimelineEntries}
        isLoading={isTimelineLoading}
        onOpenThread={handleOpenInConversation}
      />
    ) : tab === "artifacts" ? (
      <ChannelArtifactsTab
        isLoading={isTimelineLoading}
        messages={visibleMessages}
        onOpenThread={handleOpenInConversation}
      />
    ) : (
      // `all` never routes here — the conversation is `ChannelPane`'s. Rendering
      // the header alone rather than throwing keeps a mis-route to a blank body
      // the reader can navigate out of, instead of a crashed channel.
      <React.Fragment />
    );

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
      {!isSinglePanelView ? (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-30 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70 dark:bg-background/70 dark:backdrop-blur-xl dark:supports-backdrop-filter:bg-background/55",
            channelChrome.headerHeight,
          )}
          data-testid="channel-shared-header-backdrop"
        />
      ) : null}

      <section
        aria-label={`Channel ${tab} view`}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-testid="channel-lens-view"
      >
        {header}
        <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-10",
              channelChrome.contentPadding,
            )}
            data-testid={`channel-lens-scroll-${tab}`}
          >
            {/* A reading column, not a full-bleed sheet: lens rows are lists
                of short lines, and at full pane width on a wide monitor the
                metadata drifts a screen away from the text it belongs to. The
                cap steps up with the viewport so very wide windows still gain
                some room. */}
            <div className="mx-auto w-full max-w-4xl min-[1600px]:max-w-5xl min-[2100px]:max-w-6xl">
              {body}
            </div>
          </div>
        </div>
      </section>

      {showRightRail && agentActivityPanel.isOpen ? (
        <RightAuxiliaryPane
          canResetWidth={canResetThreadPanelWidth}
          onResetWidth={onResetThreadPanelWidth}
          onResizeStart={onThreadPanelResizeStart}
          testId="agent-activity-auxiliary-pane"
          widthPx={threadPanelWidthPx}
        >
          <AgentActivityPanel
            canResetWidth={canResetThreadPanelWidth}
            isSinglePanelView={false}
            layout="split"
            onClose={closeAgentActivityPanel}
            onResetWidth={onResetThreadPanelWidth}
            onResizeStart={onThreadPanelResizeStart}
            onSelectAgent={selectAgentActivityAgent}
            profiles={profiles}
            selectedPubkey={agentActivityPanel.selectedPubkey}
            transparentChrome
            widthPx={threadPanelWidthPx}
          />
        </RightAuxiliaryPane>
      ) : showRightRail ? (
        <AgentActivityRail profiles={profiles} />
      ) : null}
    </div>
  );
});

/**
 * One agent list from the two the pane carries.
 *
 * `activityAgents` defaults to `agentSessionAgents` but can be narrowed by the
 * caller, and the Work tab needs a display name for whoever the turn store
 * reports — including an agent that is working here but absent from the
 * narrowed list. Union, first name wins.
 */
function mergeAgentsByPubkey(
  activityAgents: readonly BotActivityAgent[] | undefined,
  agentSessionAgents: readonly BotActivityAgent[],
): BotActivityAgent[] {
  const byPubkey = new Map<string, BotActivityAgent>();
  for (const agent of activityAgents ?? []) {
    byPubkey.set(agent.pubkey.toLowerCase(), agent);
  }
  for (const agent of agentSessionAgents) {
    const key = agent.pubkey.toLowerCase();
    if (!byPubkey.has(key)) byPubkey.set(key, agent);
  }
  return [...byPubkey.values()];
}
