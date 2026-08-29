import { normalizePubkey } from "@/shared/lib/pubkey";

/**
 * One agent as the roster knows it. Structural rather than `Pick<ManagedAgent,
 * …>` so this module stays a pure function of three plain inputs and its tests
 * can build rows by hand.
 */
export type AgentRunRosterEntry = {
  pubkey: string;
  name: string;
  avatarUrl?: string | null;
};

/** One channel an agent has a live turn in, with its name already resolved. */
export type AgentRunChannel = {
  channelId: string;
  channelName: string | null;
  anchorAt: number;
  /**
   * A DM is named differently on screen: its record's name is a generic "DM",
   * so `#DM` reads like a room that does not exist. Optional so hand-built
   * test rows and older callers keep working; absent means "not a DM".
   */
  isDm?: boolean;
};

export type AgentRunSummary = {
  pubkey: string;
  name: string;
  avatarUrl: string | null;
  /** Empty when the agent is on the roster but has no turn in flight. */
  channels: AgentRunChannel[];
  /**
   * Earliest anchor across `channels`, or `null` when idle. The run's age is
   * how long the *oldest* live turn has been going, not the newest: an agent
   * that picked up a second channel a moment ago has still been working for the
   * whole stretch, and resetting the counter would read as a run that keeps
   * starting over.
   */
  startedAt: number | null;
};

export type AgentRunGroups = {
  working: AgentRunSummary[];
  standingBy: AgentRunSummary[];
};

/**
 * Turn the roster and the live-turn store into the two lists the runs panel
 * shows.
 *
 * The split is the only one the data supports honestly. `working` is
 * observer-backed fact — the agent has a turn the store has not seen end.
 * `standingBy` is everything else the caller passed, which is why the caller is
 * expected to have filtered to running/deployed agents first: a stopped agent is
 * not standing by, it is off, and this function has no status field to tell the
 * difference. There is deliberately no "recently active" tier — nothing in the
 * live store records when a turn *ended*, so any recency ordering would be
 * invented.
 *
 * Turns whose agent is absent from `agents` are dropped rather than surfaced as
 * an unnamed row: the store tracks any pubkey the observer stream mentions,
 * including agents this user does not manage, and a run we cannot name or open
 * is not a run the reader can act on.
 */
export function buildAgentRunSummaries(input: {
  agents: readonly AgentRunRosterEntry[];
  activeChannelTurns: readonly {
    channelId: string;
    anchorAt: number;
    agentPubkeys: readonly string[];
  }[];
  channelNameFor: (channelId: string) => string | null;
  /** Optional so existing callers and tests stay valid; absent means "no DMs". */
  isDmChannel?: (channelId: string) => boolean;
}): AgentRunGroups {
  const { agents, activeChannelTurns, channelNameFor, isDmChannel } = input;

  // The turn store keys on normalized pubkeys; the roster carries whatever the
  // backend recorded. Normalize both sides rather than trusting them to agree.
  const channelsByAgent = new Map<string, AgentRunChannel[]>();
  for (const turn of activeChannelTurns) {
    for (const pubkey of turn.agentPubkeys) {
      const key = normalizePubkey(pubkey);
      const entry: AgentRunChannel = {
        channelId: turn.channelId,
        channelName: channelNameFor(turn.channelId),
        anchorAt: turn.anchorAt,
        isDm: isDmChannel?.(turn.channelId) ?? false,
      };
      const existing = channelsByAgent.get(key);
      if (existing) existing.push(entry);
      else channelsByAgent.set(key, [entry]);
    }
  }

  const working: AgentRunSummary[] = [];
  const standingBy: AgentRunSummary[] = [];
  const seen = new Set<string>();

  for (const agent of agents) {
    const key = normalizePubkey(agent.pubkey);
    if (seen.has(key)) continue;
    seen.add(key);

    const channels = (channelsByAgent.get(key) ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.anchorAt - b.anchorAt || a.channelId.localeCompare(b.channelId),
      );

    const summary: AgentRunSummary = {
      pubkey: agent.pubkey,
      name: agent.name,
      avatarUrl: agent.avatarUrl ?? null,
      channels,
      startedAt: channels.length > 0 ? channels[0].anchorAt : null,
    };

    if (channels.length > 0) working.push(summary);
    else standingBy.push(summary);
  }

  // Longest-running first. The run that has been going the longest is the one
  // most likely to have gone wrong, so it earns the top of the list rather than
  // sliding down it as newer runs start.
  working.sort(
    (a, b) =>
      (a.startedAt ?? 0) - (b.startedAt ?? 0) ||
      a.name.localeCompare(b.name) ||
      a.pubkey.localeCompare(b.pubkey),
  );
  standingBy.sort(
    (a, b) => a.name.localeCompare(b.name) || a.pubkey.localeCompare(b.pubkey),
  );

  return { working, standingBy };
}

/**
 * One channel as its display reference: `#name` for a room, "a DM" for a DM.
 *
 * A DM's record is named a generic "DM", so hash-prefixing it prints `#DM` —
 * which reads as a room called DM rather than a private conversation.
 */
export function formatChannelRef(
  channel: Pick<AgentRunChannel, "channelName" | "isDm">,
): string | null {
  if (channel.isDm) return "a DM";
  return channel.channelName ? `#${channel.channelName}` : null;
}

/**
 * Where a run is happening, in the width a ~364px panel has for it.
 *
 * Names are the useful part, so one channel spells itself out and several show
 * the first plus a count rather than a list that truncates mid-word. A channel
 * whose name has not loaded yet degrades to "a channel" instead of its id: a
 * bare UUID tells the reader nothing and fills the whole line doing it.
 */
export function formatRunChannelLabel(
  channels: readonly AgentRunChannel[],
): string | null {
  if (channels.length === 0) return null;

  const refs = channels.flatMap((channel) => {
    const ref = formatChannelRef(channel);
    return ref ? [ref] : [];
  });
  if (channels.length === 1) {
    return refs.length === 1 ? refs[0] : "a channel";
  }
  if (refs.length === 0) return `${channels.length} channels`;
  return `${refs[0]} +${channels.length - 1}`;
}

/**
 * The one-line answer to "what is this agent doing?".
 *
 * `elapsedLabel` is passed in rather than derived here because it ticks: the
 * clock lives in whichever leaf component displays it, so this stays a pure
 * function and only the counter re-renders each second.
 */
export function formatAgentRunStatusLine(input: {
  channels: readonly AgentRunChannel[];
  elapsedLabel: string | null;
}): string {
  const where = formatRunChannelLabel(input.channels);
  if (!where) return "Idle";
  return input.elapsedLabel
    ? `Working in ${where} for ${input.elapsedLabel}`
    : `Working in ${where}`;
}
