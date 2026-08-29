import type { ActiveChannelTurnSummary } from "@/features/agents/activeAgentTurnsStore";
import type {
  MainTimelineEntry,
  TimelineThreadSummaryParticipant,
} from "@/features/messages/lib/threadPanel";
import type { TimelineMessage } from "@/features/messages/types";
import type { FeedItem } from "@/shared/api/types";
import {
  KIND_APPROVAL_REQUEST,
  KIND_STREAM_MESSAGE_DIFF,
} from "@/shared/constants/kinds";
import { parseImetaTags } from "@/shared/ui/markdown/parseImeta";

/**
 * Every projection the Work / Threads / Artifacts lenses read, with no React in
 * sight.
 *
 * The three tabs are re-readings of one channel's message window, so the part
 * worth getting right is the reading itself — which message counts as a thread,
 * which one produced a file, what order any of it goes in. Kept here so those
 * rules can be pinned by a unit test instead of by squinting at a rendered
 * list, and so a tab component stays a tab component.
 *
 * Ordering is total everywhere: every comparator falls through to the event id
 * so two events sharing a second cannot swap places between renders. A list
 * that reshuffles on a tick reads as data changing when nothing did.
 */

/** One thread as the Threads lens lists it. */
export type ChannelThreadRow = {
  /** The thread head's event id — also the row key. */
  id: string;
  message: TimelineMessage;
  replyCount: number;
  /**
   * Newest reply, in unix seconds, falling back to the head's own timestamp.
   * A thread whose replies are all outside the loaded window still has to sort
   * somewhere, and its head is the only honest answer available.
   */
  lastActivityAt: number;
  participants: TimelineThreadSummaryParticipant[];
};

/**
 * A thread is an entry the timeline gave a summary to — the same test the
 * conversation uses to decide a message deserves a reply-count row, so the two
 * surfaces can never disagree about what a thread is.
 */
export function selectChannelThreadRows(
  entries: readonly MainTimelineEntry[],
): ChannelThreadRow[] {
  const rows: ChannelThreadRow[] = [];

  for (const entry of entries) {
    const summary = entry.summary;
    if (!summary) continue;

    rows.push({
      id: entry.message.id,
      message: entry.message,
      replyCount: summary.replyCount,
      lastActivityAt: summary.lastReplyAt ?? entry.message.createdAt,
      participants: summary.participants,
    });
  }

  return rows.sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt || compareIds(a.id, b.id),
  );
}

/**
 * How many of a thread's *known* participants are agents.
 *
 * A floor, not a census: the summary caps its participant list, so a thread
 * can hold agents this cannot see. That direction is the safe one — the row
 * may under-report agents but never claims one that is not there — which is
 * why the result is a count of known agents and not a humans/agents split:
 * "2 humans" computed from a capped list would confidently misstate the
 * thread's size.
 */
export function countThreadAgentParticipants(
  row: Pick<ChannelThreadRow, "message" | "participants">,
  agentPubkeys: ReadonlySet<string>,
): number {
  if (agentPubkeys.size === 0) return 0;

  const seen = new Set<string>();
  const rootPubkey = row.message.pubkey?.toLowerCase();
  if (rootPubkey && agentPubkeys.has(rootPubkey)) seen.add(rootPubkey);
  for (const participant of row.participants) {
    const pubkey = participant.id.toLowerCase();
    if (agentPubkeys.has(pubkey)) seen.add(pubkey);
  }
  return seen.size;
}

/** One diff message, flattened into what a list row needs. */
export type ChannelCodeArtifact = {
  id: string;
  message: TimelineMessage;
  /** `file` tag — the path the diff touches, when the producer sent one. */
  filePath: string | null;
  /** `commit` tag, already shortened for display. */
  commitSha: string | null;
  description: string | null;
  repoUrl: string | null;
  createdAt: number;
  added: number;
  removed: number;
};

/**
 * The diffs an agent produced in this channel, newest first.
 *
 * Line counts come from a scan of the unified diff rather than
 * `parseUnifiedDiff`, deliberately. That parser builds the full hunk tree the
 * diff *viewer* renders, and a lens that only wants "+12 −3" would be paying
 * for a syntax tree per row on every artifact in the window. Counting the two
 * prefixes is the whole requirement, and it keeps this module free of
 * `react-diff-view` so it stays loadable by a plain node test.
 */
export function selectChannelCodeArtifacts(
  messages: readonly TimelineMessage[],
): ChannelCodeArtifact[] {
  const artifacts: ChannelCodeArtifact[] = [];

  for (const message of messages) {
    if (message.kind !== KIND_STREAM_MESSAGE_DIFF) continue;

    const { added, removed } = countDiffLineChanges(message.body);
    artifacts.push({
      id: message.id,
      message,
      filePath: readTag(message, "file"),
      commitSha: shortCommitSha(readTag(message, "commit")),
      description: readTag(message, "description"),
      repoUrl: readTag(message, "repo"),
      createdAt: message.createdAt,
      added,
      removed,
    });
  }

  return artifacts.sort(
    (a, b) => b.createdAt - a.createdAt || compareIds(a.id, b.id),
  );
}

/** Every diff that touched one path, so a file reads as one line of history. */
export type ChannelCodeArtifactGroup = {
  /** The `file` tag, or `null` for diffs that arrived without one. */
  filePath: string | null;
  latestAt: number;
  artifacts: ChannelCodeArtifact[];
};

/**
 * Group diffs by the file they touch.
 *
 * Agents commit the same path repeatedly inside one run, so an ungrouped list
 * is mostly the same filename over and over and the shape of the change is lost
 * in it. Diffs with no `file` tag collapse into a single trailing group rather
 * than one group each — they are unidentifiable, not individually interesting.
 */
export function groupChannelCodeArtifactsByFile(
  artifacts: readonly ChannelCodeArtifact[],
): ChannelCodeArtifactGroup[] {
  const groups = new Map<string, ChannelCodeArtifactGroup>();

  for (const artifact of artifacts) {
    const key = artifact.filePath ?? "";
    const existing = groups.get(key);
    if (existing) {
      existing.artifacts.push(artifact);
      existing.latestAt = Math.max(existing.latestAt, artifact.createdAt);
      continue;
    }
    groups.set(key, {
      filePath: artifact.filePath,
      latestAt: artifact.createdAt,
      artifacts: [artifact],
    });
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.latestAt - a.latestAt || compareIds(a.filePath ?? "", b.filePath ?? ""),
  );
}

/** One NIP-92 attachment, lifted off the message that carried it. */
export type ChannelFileArtifact = {
  /** `${messageId}:${url}` — one message can carry several attachments. */
  id: string;
  message: TimelineMessage;
  url: string;
  /** `filename` when the uploader sent one, else the URL's last path segment. */
  label: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: number;
};

/**
 * Files people and agents actually attached here, newest first.
 *
 * Sourced from `imeta` tags rather than from the message body: the body carries
 * attachments as markdown that the renderer resolves, and re-deriving them from
 * prose would mean re-implementing that parse and inheriting its false
 * positives. The tags are the structured copy, and they are already on every
 * message in the window — no extra query, no guessing.
 *
 * Links pasted as plain text are *not* here. They exist only as body text with
 * no structured counterpart, so the Artifacts lens says so rather than
 * inventing a heuristic that quietly disagrees with what is on screen.
 */
export function selectChannelFileArtifacts(
  messages: readonly TimelineMessage[],
): ChannelFileArtifact[] {
  const files: ChannelFileArtifact[] = [];

  for (const message of messages) {
    const tags = message.tags;
    if (!tags || tags.length === 0) continue;

    for (const entry of parseImetaTags(tags).values()) {
      if (!entry.url) continue;
      files.push({
        id: `${message.id}:${entry.url}`,
        message,
        url: entry.url,
        label: entry.filename?.trim() || fileNameFromUrl(entry.url),
        mimeType: entry.m ?? "",
        sizeBytes:
          typeof entry.size === "number" && Number.isFinite(entry.size)
            ? entry.size
            : null,
        createdAt: message.createdAt,
      });
    }
  }

  return files.sort(
    (a, b) => b.createdAt - a.createdAt || compareIds(a.id, b.id),
  );
}

/**
 * Feed items in this channel that are blocked on the reader, approvals first.
 *
 * The two-key sort is the point: an approval request is the only item here the
 * reader can unblock by deciding something, so it outranks recency. Within each
 * group the newest is on top, because a stale approval is usually the one
 * already handled somewhere else.
 */
export function selectChannelNeedsYouItems(
  items: readonly FeedItem[] | undefined,
  channelId: string | null,
): FeedItem[] {
  if (!items || !channelId) return [];

  return items
    .filter((item) => item.channelId === channelId)
    .sort(
      (a, b) =>
        Number(isApprovalRequest(b)) - Number(isApprovalRequest(a)) ||
        b.createdAt - a.createdAt ||
        compareIds(a.id, b.id),
    );
}

/** An approval is the one `needs_action` kind the reader can actually clear. */
export function isApprovalRequest(item: FeedItem): boolean {
  return item.kind === KIND_APPROVAL_REQUEST;
}

/** Who is mid-turn in one channel, and since when. */
export type ChannelWorkingAgents = {
  agentPubkeys: string[];
  /** Earliest live turn in the channel, epoch ms on the desktop clock. */
  anchorAt: number;
};

/**
 * Narrow the cross-channel turn store to one channel.
 *
 * Returns `null` rather than an empty summary when nothing is running, so the
 * caller branches on presence instead of on a zero-length array — the Work lens
 * shows a different surface entirely in that case, not a shorter list.
 */
export function selectChannelWorkingAgents(
  turns: readonly ActiveChannelTurnSummary[],
  channelId: string | null,
): ChannelWorkingAgents | null {
  if (!channelId) return null;

  const summary = turns.find((turn) => turn.channelId === channelId);
  if (!summary || summary.agentPubkeys.length === 0) return null;

  return {
    agentPubkeys: [...summary.agentPubkeys].sort(compareIds),
    anchorAt: summary.anchorAt,
  };
}

/**
 * Added and removed line counts for a unified diff.
 *
 * File headers (`+++`/`---`) are excluded — they start with the same prefixes
 * as content lines and would add a phantom +1/−1 to every single file in every
 * diff, which is exactly the kind of quietly-wrong number a reader cannot spot.
 */
export function countDiffLineChanges(content: string | undefined): {
  added: number;
  removed: number;
} {
  if (!content) return { added: 0, removed: 0 };

  let added = 0;
  let removed = 0;

  for (const line of content.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    else if (line.startsWith("-")) removed += 1;
  }

  return { added, removed };
}

/** Git's own 7-character short form, so the sha matches what a terminal shows. */
export function shortCommitSha(sha: string | null): string | null {
  const trimmed = sha?.trim();
  if (!trimmed) return null;
  return trimmed.length > 7 ? trimmed.slice(0, 7) : trimmed;
}

/**
 * One-line stand-in for a message in a list row.
 *
 * Newlines collapse to spaces because a row is one line tall and a hard wrap
 * would otherwise silently truncate a thread title at its first paragraph
 * break, which reads as an empty thread rather than a long one.
 */
export function buildMessageExcerpt(body: string | undefined, max = 140) {
  const collapsed = (body ?? "").replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

function readTag(message: TimelineMessage, name: string): string | null {
  const value = message.tags?.find((tag) => tag[0] === name)?.[1];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function fileNameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? url;
  const segments = withoutQuery.split("/");
  return segments[segments.length - 1] || url;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
