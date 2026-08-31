import * as React from "react";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
import {
  buildAgentRunSummaries,
  formatRunChannelLabel,
  type AgentRunSummary,
} from "@/features/agents/lib/agentRunSummaries";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { useChannelsQuery } from "@/features/channels/hooks";
import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cn } from "@/shared/lib/cn";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { useNow } from "@/shared/lib/useNow";

/**
 * Every agent that is working right now, across every channel, in one list.
 *
 * The panel's other face answers "what is this agent doing?"; this one answers
 * the question you actually arrive with — "is anything running, and where?" —
 * without making the reader page through a picker one agent at a time. Rows are
 * cross-channel on purpose: an agent's run is the unit of attention, and which
 * channel it happens to be in is a property of the run, not a place you have to
 * navigate to first.
 *
 * Renders as bare sections rather than an `AuxiliaryPanel`: this mounts inside
 * the activity panel's body, which already draws the surface, the header and
 * the divider. A second panel here would read as a box inside a panel — the
 * doubling every sibling in that chain exists to avoid.
 *
 * Two tiers, and only two, because only two are honest. "Working" is
 * observer-backed fact. "Standing by" is the rest of the running roster.
 * There is no "recently active" tier: nothing records when a turn ended, so its
 * ordering would be invented — see `buildAgentRunSummaries`.
 */
export function AgentRunsList({
  onSelectAgent,
  profiles,
}: {
  onSelectAgent: (pubkey: string) => void;
  profiles?: UserProfileLookup;
}): React.ReactElement {
  const managedAgentsQuery = useManagedAgentsQuery();
  const relayAgentsQuery = useRelayAgentsQuery();
  const activeChannelTurns = useActiveAgentTurnsByChannel();
  const channelsQuery = useChannelsQuery();

  // One pass over the channel list per data change, not one `find` per lookup
  // per render — this list re-renders on every live-turn tick.
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

  // Same roster the picker uses: locally managed agents that are running or
  // deployed, plus every agent registered on the relay — including ones owned
  // by someone else, whose runs arrive through public observer frames.
  const agents = React.useMemo(() => {
    const managed = (managedAgentsQuery.data ?? []).filter(
      isManagedAgentActive,
    );
    const managedPubkeys = new Set(
      managed.map((agent) => normalizePubkey(agent.pubkey)),
    );
    const relayOnly = (relayAgentsQuery.data ?? []).filter(
      (agent) => !managedPubkeys.has(normalizePubkey(agent.pubkey)),
    );
    return [...managed, ...relayOnly];
  }, [managedAgentsQuery.data, relayAgentsQuery.data]);

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

  return (
    // `z-[35]` is the split-chrome contract, tuned: above the channel's
    // shared backdrop (z-30) so rows never render ghosted under its blur,
    // below the panel's own header layer (z-40) so scrolling still slides
    // rows under the title's translucency.
    <div
      className="relative z-[35] min-h-0 flex-1 overflow-y-auto"
      data-testid="agent-runs-list"
    >
      {agents.length === 0 ? (
        // Suppressed while the roster is still loading: an empty list that
        // flashes "no agents" before the first response reads as a wrong
        // answer rather than as a pending one.
        managedAgentsQuery.isPending || relayAgentsQuery.isPending ? null : (
          <p
            className="px-4 py-6 text-center text-sm text-muted-foreground"
            data-testid="agent-runs-list-empty"
          >
            No active agents. Start or deploy an agent to watch it work.
          </p>
        )
      ) : (
        <>
          {working.length > 0 ? (
            <RunSection
              label={working.length === 1 ? "Working" : "Working now"}
            >
              {working.map((summary) => (
                <RunRow
                  key={summary.pubkey}
                  onSelect={onSelectAgent}
                  profiles={profiles}
                  summary={summary}
                />
              ))}
            </RunSection>
          ) : (
            <p
              className="px-4 py-5 text-center text-sm text-muted-foreground"
              data-testid="agent-runs-list-idle"
            >
              Nothing running right now.
            </p>
          )}

          {standingBy.length > 0 ? (
            <RunSection label="Standing by">
              {standingBy.map((summary) => (
                <RunRow
                  key={summary.pubkey}
                  onSelect={onSelectAgent}
                  profiles={profiles}
                  summary={summary}
                />
              ))}
            </RunSection>
          ) : null}
        </>
      )}
    </div>
  );
}

function RunSection({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <section className="border-b border-border/60 py-2 last:border-b-0">
      <h3 className="px-4 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <div className="px-1.5">{children}</div>
    </section>
  );
}

function RunRow({
  onSelect,
  profiles,
  summary,
}: {
  onSelect: (pubkey: string) => void;
  profiles?: UserProfileLookup;
  summary: AgentRunSummary;
}) {
  // The relay profile wins over the local record when it has one: the roster's
  // name and picture are whatever this machine last wrote, while the profile is
  // what everyone else in the community sees the agent as.
  const profile = profiles?.[normalizePubkey(summary.pubkey)];
  const name = resolveUserLabel({
    fallbackName: summary.name,
    profiles,
    pubkey: summary.pubkey,
  });
  const avatarUrl = profile?.avatarUrl ?? summary.avatarUrl;
  const where = formatRunChannelLabel(summary.channels);

  return (
    <button
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors",
        "hover:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
      )}
      data-testid="agent-runs-list-row"
      onClick={() => onSelect(summary.pubkey)}
      type="button"
    >
      <ProfileAvatar
        avatarUrl={avatarUrl ?? null}
        className="h-7 w-7 shrink-0 text-xs"
        label={name}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {where ?? "Standing by"}
        </span>
      </span>
      {summary.startedAt !== null ? (
        <RunElapsed anchorAt={summary.startedAt} />
      ) : null}
    </button>
  );
}

/**
 * The live age of one run.
 *
 * The 1s tick is mounted here, at the leaf, and only for rows that are actually
 * running — the same placement the working badges use, so a list of idle agents
 * subscribes to no timer at all.
 */
function RunElapsed({ anchorAt }: { anchorAt: number }) {
  const now = useNow(1000);

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-2xs tabular-nums text-muted-foreground">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
      />
      {formatElapsed(now - anchorAt)}
    </span>
  );
}
