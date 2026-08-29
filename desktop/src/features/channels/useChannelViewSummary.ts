import * as React from "react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import { getChannelDescription } from "@/features/channels/lib/channelDescription";
import { useHomeFeedQuery } from "@/features/home/hooks";
import type { Channel } from "@/shared/api/types";

export type ChannelViewSummary = {
  /**
   * What the channel says it is for. Reused from the channel's existing
   * description rather than a new "goal" field: a second free-text purpose
   * would immediately disagree with the first one, and the product has exactly
   * one place where a channel states its intent today.
   */
  goal: string | null;
  /** Agents mid-turn in this channel right now. */
  runningCount: number;
  /**
   * Items in this channel that are blocked on the reader — approvals and other
   * `needs_action` feed entries. Sourced from the home feed rather than a new
   * query because the relay already computes this set per user, and a
   * channel-scoped duplicate would drift from what Home shows.
   */
  needsYouCount: number;
};

/**
 * The header's answer to "where is this channel at?".
 *
 * Deliberately cheap: everything here is either already in memory (the active
 * turn store) or already being polled for the Home screen (the feed query), so
 * mounting this in every channel header costs no additional relay traffic.
 * That constraint is why thread and artifact counts are *not* here — they would
 * need the channel's messages, which only the pane below has, and lifting that
 * into the header to decorate two tab badges is not a trade worth making.
 */
export function useChannelViewSummary(
  activeChannel: Channel | null,
): ChannelViewSummary {
  const activeTurns = useActiveAgentTurnsByChannel();
  const homeFeed = useHomeFeedQuery();

  const channelId = activeChannel?.id ?? null;
  const needsAction = homeFeed.data?.feed.needsAction;

  const runningCount = React.useMemo(() => {
    if (!channelId) return 0;
    const entry = activeTurns.find((turn) => turn.channelId === channelId);
    return entry?.agentPubkeys.length ?? 0;
  }, [activeTurns, channelId]);

  const needsYouCount = React.useMemo(() => {
    if (!channelId || !needsAction) return 0;
    return needsAction.filter((item) => item.channelId === channelId).length;
  }, [channelId, needsAction]);

  const goal = React.useMemo(() => {
    const description = getChannelDescription(activeChannel)?.trim() ?? "";
    return description.length > 0 ? description : null;
  }, [activeChannel]);

  return { goal, needsYouCount, runningCount };
}
