import * as React from "react";
import { AlertCircle, Bot } from "lucide-react";

import {
  useActiveAgentTurns,
  useActiveAgentTurnsByChannel,
} from "@/features/agents/activeAgentTurnsStore";
import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import {
  isApprovalRequest,
  selectChannelNeedsYouItems,
  selectChannelWorkingAgents,
} from "@/features/channels/lib/channelLensData";
import {
  ChannelLensEmpty,
  ChannelLensList,
  ChannelLensSection,
  ChannelLensSoon,
} from "@/features/channels/ui/ChannelLensChrome";
import type { BotActivityAgent } from "@/features/channels/ui/BotActivityBar";
import { formatThreadSummaryLastReplyTime } from "@/features/messages/lib/dateFormatters";
import { hasLinkPreviewSuppression } from "@/features/messages/lib/formatTimelineMessages";
import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { useHomeFeedQuery } from "@/features/home/hooks";
import type { FeedItem } from "@/shared/api/types";
import { resolveMentionProps } from "@/shared/lib/resolveMentionNames";
import { useNow } from "@/shared/lib/useNow";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Markdown } from "@/shared/ui/markdown";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/** The elapsed counter ticks once a second, like every other one in the app. */
const ELAPSED_TICK_MS = 1_000;

/**
 * The channel read as the work happening in it.
 *
 * Ordered by who is waiting on whom: what is blocked on *you* comes first,
 * because that is the only thing on this screen that will not move until you
 * move it, then what the agents are doing on their own. Reversing those two
 * turns the tab into a status board — pleasant to watch, useless as a queue.
 *
 * What this tab deliberately does not show is as load-bearing as what it does.
 * The relay reports that a turn is live and when it started; it reports no step
 * index, no plan length, no token or dollar spend, and offers no revert. A
 * progress bar drawn from a start time alone is a guess presented as a
 * measurement, so the affordances that would need one are listed as pending
 * instead of mocked.
 */
export function ChannelWorkTab({
  activeChannel,
  agents,
  currentPubkey,
  onOpenAgentSession,
  profiles,
}: {
  activeChannel: { id: string; name?: string } | null;
  /** Agents this channel already knows about — the source of display names. */
  agents: readonly BotActivityAgent[];
  currentPubkey?: string;
  onOpenAgentSession: (pubkey: string, channelId?: string | null) => void;
  profiles?: UserProfileLookup;
}) {
  const channelId = activeChannel?.id ?? null;
  const activeTurns = useActiveAgentTurnsByChannel();
  const homeFeed = useHomeFeedQuery();
  const needsAction = homeFeed.data?.feed.needsAction;

  const working = React.useMemo(
    () => selectChannelWorkingAgents(activeTurns, channelId),
    [activeTurns, channelId],
  );
  const needsYouItems = React.useMemo(
    () => selectChannelNeedsYouItems(needsAction, channelId),
    [channelId, needsAction],
  );
  const agentNamesByPubkey = React.useMemo(() => {
    const names = new Map<string, string>();
    for (const agent of agents) {
      names.set(agent.pubkey.toLowerCase(), agent.name);
    }
    return names;
  }, [agents]);

  return (
    <div className="flex min-w-0 flex-col gap-5" data-testid="channel-work-tab">
      <ChannelLensSection
        count={needsYouItems.length}
        icon={AlertCircle}
        testId="channel-work-tab-needs-you"
        title="Waiting on you"
      >
        {needsYouItems.length > 0 ? (
          <ChannelLensList testId="channel-work-tab-needs-you-list">
            {needsYouItems.map((item) => (
              <NeedsYouRow
                currentPubkey={currentPubkey}
                item={item}
                key={item.id}
                profiles={profiles}
              />
            ))}
          </ChannelLensList>
        ) : (
          <ChannelLensEmpty
            message="Nothing is blocked on you — approvals and anything else needing your call would land here."
            testId="channel-work-tab-needs-you-empty"
          />
        )}
      </ChannelLensSection>

      <ChannelLensSection
        count={working?.agentPubkeys.length}
        icon={Bot}
        testId="channel-work-tab-running"
        title="Working now"
      >
        {working ? (
          <ChannelLensList testId="channel-work-tab-running-list">
            {working.agentPubkeys.map((pubkey) => (
              <WorkingAgentRow
                channelAnchorAt={working.anchorAt}
                channelId={channelId}
                fallbackName={agentNamesByPubkey.get(pubkey.toLowerCase())}
                key={pubkey}
                onOpenAgentSession={onOpenAgentSession}
                profiles={profiles}
                pubkey={pubkey}
              />
            ))}
          </ChannelLensList>
        ) : (
          <ChannelLensEmpty
            message="No agent is working here — mention one in the conversation and its run appears while it works."
            testId="channel-work-tab-running-empty"
          />
        )}
      </ChannelLensSection>

      {/* One block for the whole class of missing controls rather than a greyed
          stub on each card: a card carrying four dead buttons reads as broken
          software, where a single note reads as a roadmap. Everything listed
          here needs relay data that does not exist — per-run step counts, spend
          accounting, and a reversible unit of work. */}
      <ChannelLensSoon
        detail="Runs report that they are live and when they started, and nothing else. Step counts, spend and a reversible unit of work all need relay events the product has not defined yet."
        items={[
          "Step and progress",
          "Time and token budget",
          "Cost per run",
          "Retry, revert and grant permission",
        ]}
        testId="channel-work-tab-controls-soon"
        title="Run controls and cost"
      />
    </div>
  );
}

/**
 * One item blocked on the reader.
 *
 * Mirrors `FeedSection`'s row on purpose — this is the same `needs_action`
 * item Home already shows, and two different-looking renderings of one event
 * make a reader wonder whether they are two events.
 */
function NeedsYouRow({
  currentPubkey,
  item,
  profiles,
}: {
  currentPubkey?: string;
  item: FeedItem;
  profiles?: UserProfileLookup;
}) {
  const label = resolveUserLabel({
    pubkey: item.pubkey,
    currentPubkey,
    profiles,
    preferResolvedSelfLabel: true,
  });
  const { mentionNames, mentionPubkeysByName } = resolveMentionProps(
    item.tags,
    profiles,
  );
  const content = item.content.trim();

  return (
    <div className="px-3 py-2.5" data-testid="channel-work-tab-needs-you-row">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {isApprovalRequest(item) ? "Approval requested" : "Needs your input"}
        </span>
        {isApprovalRequest(item) ? (
          <Badge className="shrink-0" variant="warning">
            blocking
          </Badge>
        ) : null}
        <span className="inline-flex min-w-0 items-center gap-1 text-2xs text-muted-foreground">
          <UserAvatar
            avatarUrl={profiles?.[item.pubkey.toLowerCase()]?.avatarUrl ?? null}
            displayName={label}
            size="xs"
          />
          <span className="truncate">{label}</span>
        </span>
        <span className="ml-auto shrink-0 text-2xs text-muted-foreground/60">
          {formatThreadSummaryLastReplyTime(item.createdAt)}
        </span>
      </div>

      <div className="mt-0.5 line-clamp-2">
        <Markdown
          className="max-w-none text-sm leading-snug text-muted-foreground"
          content={content || "A workflow is waiting for approval."}
          linkPreviewsSuppressed={hasLinkPreviewSuppression(item.tags)}
          mentionNames={mentionNames}
          mentionPubkeysByName={mentionPubkeysByName}
          messageId={item.id}
        />
      </div>
    </div>
  );
}

/**
 * One agent mid-turn in this channel.
 *
 * The elapsed counter reads the agent's *own* anchor rather than the channel's,
 * which matters the moment two agents are working here: the channel anchor is
 * the earliest of them, so borrowing it would tell the reader the agent that
 * just started has been running for twenty minutes. Falls back to the channel
 * anchor only when the per-agent store has not caught up, which is a brief
 * window on first paint.
 */
function WorkingAgentRow({
  channelAnchorAt,
  channelId,
  fallbackName,
  onOpenAgentSession,
  profiles,
  pubkey,
}: {
  channelAnchorAt: number;
  channelId: string | null;
  fallbackName?: string;
  onOpenAgentSession: (pubkey: string, channelId?: string | null) => void;
  profiles?: UserProfileLookup;
  pubkey: string;
}) {
  const agentTurns = useActiveAgentTurns(pubkey);
  const now = useNow(ELAPSED_TICK_MS);
  const anchorAt =
    agentTurns.find((turn) => turn.channelId === channelId)?.anchorAt ??
    channelAnchorAt;
  const label = resolveUserLabel({
    pubkey,
    fallbackName: fallbackName ?? null,
    profiles,
  });

  return (
    <div
      className="flex min-w-0 items-center gap-3 px-3 py-2.5"
      data-testid="channel-work-tab-running-row"
    >
      <UserAvatar
        avatarUrl={profiles?.[pubkey.toLowerCase()]?.avatarUrl ?? null}
        displayName={label}
        size="sm"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
          />
          <span className="tabular-nums">
            Working for {formatElapsed(now - anchorAt)}
          </span>
        </span>
      </div>

      <Button
        className="shrink-0"
        data-testid="channel-work-tab-running-open"
        onClick={() => {
          onOpenAgentSession(pubkey, channelId);
        }}
        size="sm"
        variant="outline"
      >
        Watch
      </Button>
    </div>
  );
}
