import type { TimelineReaction } from "@/features/messages/types";

/**
 * The agent harness signals lifecycle through reactions (`buzz-acp`):
 * 👀 = the event is queued ("seen"), 💬 = an agent is running its turn.
 * Those are protocol, not sentiment — rendering them as reaction chips reads
 * as "three people reacted 👀". This module splits them out so the timeline
 * can show them WhatsApp-style: a quiet "seen" tick line and a working
 * indicator, while human reactions (including a human genuinely reacting 👀)
 * keep their chips.
 */
export const AGENT_SEEN_REACTION = "👀";
export const AGENT_WORKING_REACTION = "💬";

/**
 * A 💬 older than this is an orphan (agent restarted mid-turn — the known
 * ghost-reaction failure), not a live turn: the harness caps turns at ~5
 * minutes (`BUZZ_ACP_TURN_TIMEOUT`), so triple that is comfortably past any
 * legitimate run. Stale working votes demote to "seen" — the agent really
 * did engage — instead of promising work nobody is doing.
 */
export const STALE_WORKING_AFTER_MS = 15 * 60_000;

export type AgentSignalUser = {
  pubkey: string;
  displayName: string;
};

export type AgentSignalSplit = {
  /** Reactions with agent signal votes removed; chips that empty out drop. */
  humanReactions: TimelineReaction[] | undefined;
  /** Agents currently holding a 👀 on this message. */
  seenByAgents: AgentSignalUser[];
  /** Agents currently holding a live (non-stale) 💬 on this message. */
  workingAgents: AgentSignalUser[];
  /**
   * When the earliest live working vote crosses the staleness cutoff, in ms
   * epoch — the caller schedules a re-render then so an indicator never
   * outlives its signal. `null` when nothing is pending expiry.
   */
  workingExpiresAtMs: number | null;
};

export function splitAgentSignalReactions(
  reactions: TimelineReaction[] | undefined,
  isAgentPubkey: (pubkey: string) => boolean,
  nowMs: number,
): AgentSignalSplit {
  if (!reactions || reactions.length === 0) {
    return {
      humanReactions: reactions,
      seenByAgents: [],
      workingAgents: [],
      workingExpiresAtMs: null,
    };
  }

  const seenByAgents: AgentSignalUser[] = [];
  const workingAgents: AgentSignalUser[] = [];
  const humanReactions: TimelineReaction[] = [];
  let workingExpiresAtMs: number | null = null;
  let changed = false;

  const addTo = (bucket: AgentSignalUser[], user: AgentSignalUser) => {
    if (!bucket.some((entry) => entry.pubkey === user.pubkey)) {
      bucket.push({ pubkey: user.pubkey, displayName: user.displayName });
    }
  };

  for (const reaction of reactions) {
    const isSeen = reaction.emoji === AGENT_SEEN_REACTION;
    const isWorking = reaction.emoji === AGENT_WORKING_REACTION;
    // Custom-image emoji reuse arbitrary shortcodes; only the plain Unicode
    // pair is the harness contract.
    if ((!isSeen && !isWorking) || reaction.emojiUrl) {
      humanReactions.push(reaction);
      continue;
    }

    const humans = reaction.users.filter((user) => !isAgentPubkey(user.pubkey));
    const agents = reaction.users.filter((user) => isAgentPubkey(user.pubkey));
    if (agents.length === 0) {
      humanReactions.push(reaction);
      continue;
    }

    changed = true;
    for (const agent of agents) {
      if (isSeen) {
        addTo(seenByAgents, agent);
        continue;
      }
      // A vote without a timestamp (optimistic echo) cannot be aged; treat
      // it as live rather than wrongly hiding a real turn.
      const expiresAtMs =
        agent.createdAt === undefined
          ? null
          : agent.createdAt * 1_000 + STALE_WORKING_AFTER_MS;
      if (expiresAtMs !== null && expiresAtMs <= nowMs) {
        addTo(seenByAgents, agent);
        continue;
      }
      addTo(workingAgents, agent);
      if (
        expiresAtMs !== null &&
        (workingExpiresAtMs === null || expiresAtMs < workingExpiresAtMs)
      ) {
        workingExpiresAtMs = expiresAtMs;
      }
    }

    if (humans.length > 0) {
      humanReactions.push({
        ...reaction,
        count: humans.length,
        users: humans,
      });
    }
  }

  return {
    // Identity-stable when nothing was extracted: rows memo on reactions.
    humanReactions: changed ? humanReactions : reactions,
    seenByAgents,
    workingAgents,
    workingExpiresAtMs,
  };
}

/** "Aby", "Aby and Jeny", "Aby, Jeny and Francisco", "Aby, Jeny +2". */
export function formatAgentSignalNames(users: AgentSignalUser[]): string {
  const names = users.map((user) => user.displayName || "Agent");
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}
