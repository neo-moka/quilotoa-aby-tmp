import type { ActiveChannelTurnSummary } from "@/features/agents/activeAgentTurnsStore";
import type { FeedItem, FeedItemCategory } from "@/shared/api/types";
import {
  KIND_APPROVAL_REQUEST,
  KIND_FORUM_COMMENT,
  KIND_FORUM_POST,
  KIND_JOB_ACCEPTED,
  KIND_JOB_CANCEL,
  KIND_JOB_ERROR,
  KIND_JOB_PROGRESS,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_REMINDER,
} from "@/shared/constants/kinds";

/**
 * How many rows either block prints before collapsing into a "N more" link.
 *
 * The section exists to answer "what should I look at?" *before* the reader
 * starts scanning channel names, so it has to stay shorter than the thing it
 * introduces. Four is the largest count that still leaves the channel list
 * above the fold on a 720px window.
 */
export const SIDEBAR_NOW_ROW_LIMIT = 4;

/** A pending item the reader is expected to act on, flattened for one row. */
export type NeedsYouRow = {
  id: string;
  label: string;
  channelId: string | null;
  channelName: string;
  createdAt: number;
  isApproval: boolean;
  /**
   * Carried through so the row can pick an icon from the classification rather
   * than by string-matching the rendered label — which would silently pick the
   * wrong glyph the first time someone rewords the copy.
   */
  category: FeedItemCategory;
  /**
   * First line of the item's content, or `null` when the event carried none.
   * The row prints it under the label so the reader can triage without
   * clicking through — "Mention" alone forces a round-trip to find out
   * whether it can wait; "Mention · are we shipping today?" does not.
   */
  snippet: string | null;
};

/**
 * Reduce event content to something that survives a one-line slot: first
 * non-empty line, inner whitespace collapsed. Returns `null` rather than an
 * empty string so callers can drop the line instead of rendering a blank.
 */
export function extractNeedsYouSnippet(content: string): string | null {
  for (const line of content.split("\n")) {
    const compact = line.replace(/\s+/g, " ").trim();
    if (compact.length > 0) return compact;
  }
  return null;
}

/** How many live agents get a full card before the rest drop to compact rows. */
export const SIDEBAR_LIVE_CARD_LIMIT = 2;

/** One agent working in one channel — the unit the Live cards render. */
export type LiveAgentEntry = {
  /** Stable identity for React keys: an agent can work in two channels at once. */
  key: string;
  agentPubkey: string;
  /** Display name, or `null` when this desktop does not manage the agent. */
  agentName: string | null;
  agentAvatarUrl: string | null;
  channelId: string;
  channelName: string;
  /** DMs print as "in a DM", not "#DM" — their record name is a generic "DM". */
  isDm: boolean;
  anchorAt: number;
};

/** Where the work is, as the Live card prints it: `#room` or `a DM`. */
export function formatLiveAgentWhere(
  entry: Pick<LiveAgentEntry, "channelName" | "isDm">,
): string {
  return entry.isDm ? "a DM" : `#${entry.channelName}`;
}

/** What a live agent card needs about an agent, beyond its key. */
export type LiveAgentIdentity = { name: string; avatarUrl: string | null };

/**
 * The canonical headline for a feed item.
 *
 * `FeedSection` grew this switch first and still carries a private copy of it;
 * this is the copy meant to survive. Two surfaces naming the same event
 * differently ("Approval requested" in one place, "Channel update" in another)
 * reads as two different events to the person triaging them, and nothing fails
 * when the copies drift — so the label lives in a module both surfaces can
 * import rather than in whichever component rendered it first.
 */
export function describeFeedItem(
  item: Pick<FeedItem, "kind" | "category">,
): string {
  switch (item.kind) {
    case KIND_REMINDER:
      return "Reminder";
    case KIND_JOB_REQUEST:
      return "Job requested";
    case KIND_JOB_ACCEPTED:
      return "Job accepted";
    case KIND_JOB_PROGRESS:
      return "Progress update";
    case KIND_JOB_RESULT:
      return "Job result";
    case KIND_JOB_CANCEL:
      return "Job cancelled";
    case KIND_JOB_ERROR:
      return "Job failed";
    case KIND_FORUM_POST:
      return "Forum post";
    case KIND_FORUM_COMMENT:
      return "Forum reply";
    case KIND_APPROVAL_REQUEST:
      return "Approval requested";
    default:
      if (item.category === "mention") {
        return "Mention";
      }

      if (item.category === "agent_activity") {
        return "Agent update";
      }

      return "Channel update";
  }
}

/** An approval blocks a workflow, which is why it outranks everything else. */
export function isApprovalRequest(item: Pick<FeedItem, "kind">): boolean {
  return item.kind === KIND_APPROVAL_REQUEST;
}

function toNeedsYouRow(item: FeedItem): NeedsYouRow {
  return {
    id: item.id,
    label: describeFeedItem(item),
    channelId: item.channelId,
    channelName: item.channelName,
    createdAt: item.createdAt,
    isApproval: isApprovalRequest(item),
    category: item.category,
    snippet: extractNeedsYouSnippet(item.content),
  };
}

/**
 * Merge the two feed buckets that are actually addressed to the reader into a
 * single ranked list.
 *
 * Three judgement calls are baked in. Approvals sort above everything because
 * something else is blocked until the reader answers, and age does not change
 * that. Items the reader already ticked off on Home are dropped — a sidebar
 * that keeps advertising handled work trains people to ignore it, which is the
 * one failure this section cannot afford. And `needsAction` and `mentions`
 * overlap (an approval that @-mentions you lands in both), so ids are deduped
 * before counting; otherwise the "N more" tail promises rows that do not exist.
 */
export function selectNeedsYouRows(input: {
  needsAction?: readonly FeedItem[];
  mentions?: readonly FeedItem[];
  doneIds?: ReadonlySet<string>;
  /**
   * Drop plain mention rows (user preference). Approvals survive even when
   * they arrived via the mentions bucket — they block someone else's work,
   * which a display preference must not hide.
   */
  hideMentions?: boolean;
  limit?: number;
}): {
  rows: NeedsYouRow[];
  hiddenCount: number;
  totalCount: number;
  /**
   * Every surviving candidate id (not just the rendered window), split by
   * whether "clear all" may sweep it — approvals are excluded because
   * marking one done without acting on it hides genuinely blocked work.
   */
  clearableIds: string[];
} {
  const limit = input.limit ?? SIDEBAR_NOW_ROW_LIMIT;
  const doneIds = input.doneIds;
  const seen = new Set<string>();
  const candidates: NeedsYouRow[] = [];

  for (const item of [
    ...(input.needsAction ?? []),
    ...(input.mentions ?? []),
  ]) {
    if (seen.has(item.id)) continue;
    if (doneIds?.has(item.id)) continue;
    if (
      input.hideMentions &&
      item.category === "mention" &&
      !isApprovalRequest(item)
    ) {
      continue;
    }
    seen.add(item.id);
    candidates.push(toNeedsYouRow(item));
  }

  candidates.sort((left, right) => {
    if (left.isApproval !== right.isApproval) {
      return left.isApproval ? -1 : 1;
    }
    return right.createdAt - left.createdAt;
  });

  const rows = limit > 0 ? candidates.slice(0, limit) : [];

  return {
    rows,
    hiddenCount: candidates.length - rows.length,
    totalCount: candidates.length,
    clearableIds: candidates
      .filter((row) => !row.isApproval)
      .map((row) => row.id),
  };
}

/**
 * Count agents with their unit attached.
 *
 * Exported so the status footer pluralises the same way the live rows do. The
 * unit is not decoration: a bare `0` sitting next to a connection word reads as
 * an error code or an unread count, not as "no agents".
 */
export function formatAgentCount(count: number): string {
  return `${count} ${count === 1 ? "agent" : "agents"}`;
}

/**
 * Age of a feed item in the shortest form that still reads unambiguously.
 *
 * `FeedSection` spells ages out ("2 minutes ago") because it has a full-width
 * row to spend. The sidebar's trailing slot is a few characters wide next to a
 * truncating label, so a spelled-out age would push the label it qualifies out
 * of view. Takes `createdAtSeconds` in Unix *seconds* — the unit `FeedItem`
 * uses — against a millisecond clock, the mismatch most likely to go unnoticed.
 */
export function formatCompactAge(
  createdAtSeconds: number,
  nowMs: number,
): string {
  const seconds = Math.floor(nowMs / 1_000) - createdAtSeconds;
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

/**
 * Explode the per-channel turn summaries into one entry per (agent, channel).
 *
 * The store aggregates by channel because that is what the channel list needs;
 * the Live cards are about *agents*, so the same data has to be inverted. One
 * agent working in two channels is two entries, not one — collapsing them would
 * hide half of what it is doing behind an arbitrary choice of channel.
 *
 * Channels the caller cannot name are dropped for the same reason the row list
 * drops them: the card's whole affordance is navigating to the work.
 */
export function buildLiveAgentEntries(input: {
  summaries: readonly ActiveChannelTurnSummary[];
  channelNameById?: ReadonlyMap<string, string>;
  agentsByPubkey?: ReadonlyMap<string, LiveAgentIdentity>;
  dmChannelIds?: ReadonlySet<string>;
}): LiveAgentEntry[] {
  const entries: LiveAgentEntry[] = [];

  for (const summary of input.summaries) {
    const channelName = input.channelNameById?.get(summary.channelId);
    if (!channelName) continue;

    for (const rawPubkey of summary.agentPubkeys) {
      const agentPubkey = rawPubkey.trim().toLowerCase();
      const identity = input.agentsByPubkey?.get(agentPubkey);

      entries.push({
        key: `${agentPubkey}:${summary.channelId}`,
        agentPubkey,
        agentName: identity?.name ?? null,
        agentAvatarUrl: identity?.avatarUrl ?? null,
        channelId: summary.channelId,
        channelName,
        isDm: input.dmChannelIds?.has(summary.channelId) ?? false,
        // Per-agent start times are not tracked in the aggregate, so every
        // agent in a channel inherits that channel's earliest anchor. It is a
        // floor on how long this agent has been working, never an overstatement.
        anchorAt: summary.anchorAt,
      });
    }
  }

  return entries;
}

/**
 * Split live agents into headline cards and the quieter overflow rows.
 *
 * The channel being read wins the cards, because "what is the agent doing in
 * the room I am looking at?" is the question the reader most often has. With
 * nothing selected, or nobody working there, the longest-running work is
 * promoted instead — a turn that has been open for twenty minutes is the one
 * worth a card, and a turn that just started will get its own attention soon.
 * Ties break on the key so the order cannot flicker between renders.
 */
export function partitionLiveAgents(
  entries: readonly LiveAgentEntry[],
  options?: {
    selectedChannelId?: string | null;
    cardLimit?: number;
    rowLimit?: number;
  },
): { cards: LiveAgentEntry[]; rows: LiveAgentEntry[]; hiddenCount: number } {
  const cardLimit = options?.cardLimit ?? SIDEBAR_LIVE_CARD_LIMIT;
  const rowLimit = options?.rowLimit ?? SIDEBAR_NOW_ROW_LIMIT;
  const selectedChannelId = options?.selectedChannelId ?? null;

  const ranked = [...entries].sort((left, right) => {
    const leftSelected = left.channelId === selectedChannelId;
    const rightSelected = right.channelId === selectedChannelId;
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (left.anchorAt !== right.anchorAt) return left.anchorAt - right.anchorAt;
    return left.key.localeCompare(right.key);
  });

  const cards = cardLimit > 0 ? ranked.slice(0, cardLimit) : [];
  const remainder = ranked.slice(cards.length);
  const rows = rowLimit > 0 ? remainder.slice(0, rowLimit) : [];

  return { cards, rows, hiddenCount: remainder.length - rows.length };
}

/**
 * Wall-clock time a turn started, for the card's detail line.
 *
 * Deliberately absolute where the headline figure is relative: "3m 12s" and
 * "Started 14:32" answer different questions, and the pair costs one line.
 */
export function formatStartedAt(anchorAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(anchorAt));
}

/**
 * Local-midnight bounds for the day containing `now`, in Unix seconds.
 *
 * Built by rolling the calendar date rather than adding 86 400 so the pair
 * stays correct across a DST change, where the local day is 23 or 25 hours.
 * The archive validates the interval against a 48-hour ceiling, so an
 * arithmetic day would not fail loudly — it would silently bucket an hour of
 * usage into the wrong day twice a year.
 */
export function localDayBoundsUnix(now: Date): [number, number] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return [
    Math.floor(start.getTime() / 1_000),
    Math.floor(end.getTime() / 1_000),
  ];
}

/**
 * Parse a NIP-AM token counter, which crosses the Tauri boundary as a decimal
 * string precisely because the full `u64` range does not survive `Number`.
 * Returns `null` for anything that is not a clean non-negative integer so a
 * malformed row degrades to "unknown" instead of `NaN` on screen.
 */
export function parseTokenField(
  value: string | null | undefined,
): bigint | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

/**
 * Abbreviate a token total for a one-line footer slot.
 *
 * Kept in `bigint` all the way to the final division so a large total is
 * abbreviated from the true value, not from a `Number` that already lost
 * precision on the way in.
 */
export function formatTokenCount(total: bigint): string {
  if (total < 0n) return "0";
  if (total < 1_000n) return String(total);

  const unit = total < 1_000_000n ? { divisor: 1_000n, suffix: "k" } : null;
  const scale = unit ?? { divisor: 1_000_000n, suffix: "M" };
  const whole = total / scale.divisor;
  const tenths = ((total % scale.divisor) * 10n) / scale.divisor;

  return tenths === 0n
    ? `${whole}${scale.suffix}`
    : `${whole}.${tenths}${scale.suffix}`;
}
