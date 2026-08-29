import { List } from "lucide-react";
import * as React from "react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import { openAgentActivityPanel } from "@/features/agents/agentActivityPanelStore";
import { useManagedAgentsQuery } from "@/features/agents/hooks";
import {
  buildAgentRunSummaries,
  formatRunChannelLabel,
} from "@/features/agents/lib/agentRunSummaries";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import { useChannelsQuery } from "@/features/channels/hooks";
import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { normalizePubkey } from "@/shared/lib/pubkey";

/**
 * The activity panel, folded down to a rail.
 *
 * When no auxiliary panel is open the channel's right edge used to be nothing
 * at all, so "is anyone working?" could only be answered by opening a panel on
 * spec. The rail keeps that answer ambient: one avatar per active agent, a
 * pulsing dot on the ones mid-turn, and the whole thing one click away from
 * the full runs list. It renders only when the community actually runs agents
 * — for everyone else a permanent empty rail would be furniture advertising a
 * feature they don't use.
 *
 * Working state is the same observer-backed fact the runs list prints; there
 * is deliberately no "waiting on you" or "finished" dot because neither is
 * recorded anywhere yet — see `buildAgentRunSummaries`.
 */
export function AgentActivityRail({
  profiles,
}: {
  profiles?: UserProfileLookup;
}): React.ReactElement | null {
  const managedAgentsQuery = useManagedAgentsQuery();
  const activeChannelTurns = useActiveAgentTurnsByChannel();
  const channelsQuery = useChannelsQuery();

  // Map lookups, not per-call `find`: the rail re-renders on live-turn ticks.
  const channelInfoById = React.useMemo(() => {
    const byId = new Map<string, { isDm: boolean; name: string }>();
    for (const channel of channelsQuery.data ?? []) {
      byId.set(channel.id, {
        isDm: channel.channelType === "dm",
        name: channel.name,
      });
    }
    return byId;
  }, [channelsQuery.data]);
  const channelNameFor = React.useCallback(
    (channelId: string) => channelInfoById.get(channelId)?.name ?? null,
    [channelInfoById],
  );
  const isDmChannel = React.useCallback(
    (channelId: string) => channelInfoById.get(channelId)?.isDm ?? false,
    [channelInfoById],
  );

  const agents = React.useMemo(
    () => (managedAgentsQuery.data ?? []).filter(isManagedAgentActive),
    [managedAgentsQuery.data],
  );

  const { working, standingBy } = React.useMemo(
    () =>
      buildAgentRunSummaries({
        agents,
        activeChannelTurns,
        channelNameFor,
        isDmChannel,
      }),
    [agents, activeChannelTurns, channelNameFor, isDmChannel],
  );

  if (agents.length === 0) return null;

  return (
    // `relative z-40` is the channel's split-chrome contract: the shared
    // header backdrop paints a blur at `z-30` across the whole pane row, and
    // a rail below that layer renders its buttons ghosted underneath it —
    // hoverable, tooltip and all, but invisible. Above it, the rail starts at
    // the top like the panel it folds down from.
    <aside
      aria-label="Agent activity"
      className="relative z-40 flex h-full w-12 shrink-0 flex-col items-center gap-2 overflow-y-auto bg-sidebar py-3 before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:top-0 before:w-px before:bg-border/80 before:content-['']"
      data-testid="agent-activity-rail"
    >
      <button
        aria-label="Active runs"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
        data-testid="agent-activity-rail-runs"
        onClick={() => openAgentActivityPanel()}
        title="Active runs"
        type="button"
      >
        <List aria-hidden="true" className="h-4 w-4" />
      </button>
      <div aria-hidden="true" className="h-px w-5 shrink-0 bg-border" />
      {[...working, ...standingBy].map((summary) => {
        const profile = profiles?.[normalizePubkey(summary.pubkey)];
        const name = resolveUserLabel({
          fallbackName: summary.name,
          profiles,
          pubkey: summary.pubkey,
        });
        const where = formatRunChannelLabel(summary.channels);
        const isWorking = summary.channels.length > 0;
        return (
          <button
            aria-label={`${name} · ${where ?? "standing by"}`}
            className="relative shrink-0 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="agent-activity-rail-agent"
            key={summary.pubkey}
            onClick={() => openAgentActivityPanel(summary.pubkey)}
            title={`${name} · ${where ?? "standing by"}`}
            type="button"
          >
            <ProfileAvatar
              avatarUrl={profile?.avatarUrl ?? summary.avatarUrl ?? null}
              className="h-8 w-8"
              label={name}
            />
            {isWorking ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar motion-safe:animate-pulse"
                data-testid="agent-activity-rail-working-dot"
              />
            ) : null}
          </button>
        );
      })}
    </aside>
  );
}
