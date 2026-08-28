import type { SearchResult } from "@/features/search/ui/SearchResultItem";
import type { Channel, SearchHit, UserSearchResult } from "@/shared/api/types";
import { truncatePubkey } from "@/shared/lib/pubkey";

const MAX_SEARCH_SUGGESTIONS = 4;

export const SEARCH_SECTION_TITLE_CLASS =
  "px-2.5 pb-1.5 pt-2 text-xs font-medium text-muted-foreground/70";

const SEARCH_RESULT_SECTION_ORDER = [
  "channels",
  "direct-messages",
  "people",
  "agents",
  "messages",
  "actions",
] as const;

export type SearchResultSectionKey =
  (typeof SEARCH_RESULT_SECTION_ORDER)[number];

export type SearchResultSection = {
  key: SearchResultSectionKey;
  results: SearchResult[];
  title: string;
};

export type SearchHitContextLabel = {
  channelLabel: string | null;
  text: string;
};

export function truncateResultText(content: string, maxLength = 96) {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return "No message body.";
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

export function formatRelativeTime(unixSeconds: number) {
  const diff = Math.floor(Date.now() / 1_000) - unixSeconds;

  if (diff < 60) {
    return "just now";
  }

  if (diff < 60 * 60) {
    return `${Math.floor(diff / 60)}m ago`;
  }

  if (diff < 60 * 60 * 24) {
    return `${Math.floor(diff / (60 * 60))}h ago`;
  }

  if (diff < 60 * 60 * 24 * 7) {
    return `${Math.floor(diff / (60 * 60 * 24))}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(unixSeconds * 1_000));
}

function getChannelActivityTime(channel: Channel) {
  if (!channel.lastMessageAt) {
    return 0;
  }

  const timestamp = Date.parse(channel.lastMessageAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getChannelSuggestionMeta(channel: Channel) {
  const activityTime = getChannelActivityTime(channel);

  if (activityTime > 0) {
    return formatRelativeTime(Math.floor(activityTime / 1_000));
  }

  return null;
}

export function getChannelDisplayName(
  channel: Channel,
  channelLabels?: Record<string, string>,
) {
  return channelLabels?.[channel.id]?.trim() || channel.name;
}

export function getChannelPreview(channel: Channel) {
  if (channel.channelType === "dm") {
    return "";
  }

  if (channel.description.trim()) {
    return channel.description;
  }

  return "";
}

export function getUserDisplayName(user: UserSearchResult) {
  return (
    user.displayName?.trim() ||
    user.nip05Handle?.trim() ||
    truncatePubkey(user.pubkey)
  );
}

export function getUserSecondaryLabel(user: UserSearchResult) {
  const displayName = user.displayName?.trim();
  const nip05Handle = user.nip05Handle?.trim();

  if (nip05Handle && nip05Handle !== displayName) {
    return nip05Handle;
  }

  return null;
}

function getSearchHitChannelName(
  hit: SearchHit,
  channelLookup: ReadonlyMap<string, Channel>,
  channelLabels?: Record<string, string>,
) {
  const channel = hit.channelId ? channelLookup.get(hit.channelId) : null;
  const channelName =
    (hit.channelId ? channelLabels?.[hit.channelId]?.trim() : null) ||
    hit.channelName?.trim() ||
    channel?.name.trim() ||
    null;

  if (!channelName) {
    return null;
  }

  return channelName;
}

export function getSearchHitContextLabel(
  hit: SearchHit,
  channelLookup: ReadonlyMap<string, Channel>,
  channelLabels?: Record<string, string>,
): SearchHitContextLabel {
  const channel = hit.channelId ? channelLookup.get(hit.channelId) : null;
  const channelName = getSearchHitChannelName(
    hit,
    channelLookup,
    channelLabels,
  );

  if (channel?.channelType === "dm") {
    return {
      channelLabel: null,
      text: "Direct message",
    };
  }

  const isThread = hit.kind === 45003 || Boolean(hit.threadRootId);

  return {
    channelLabel: channelName,
    text: channelName
      ? `${isThread ? "Thread" : "Message"} in`
      : isThread
        ? "Thread"
        : "Message",
  };
}

function getResultSectionKey(result: SearchResult): SearchResultSectionKey {
  if (result.kind === "channel") {
    return result.channel.channelType === "dm" ? "direct-messages" : "channels";
  }

  if (result.kind === "user") {
    return result.user.isAgent ? "agents" : "people";
  }

  if (result.kind === "action") {
    return "actions";
  }

  return "messages";
}

function getSectionTitle(sectionKey: SearchResultSectionKey) {
  switch (sectionKey) {
    case "channels":
      return "Channels";
    case "direct-messages":
      return "Direct messages";
    case "people":
      return "People";
    case "agents":
      return "Agents";
    case "messages":
      return "Most relevant";
    case "actions":
      return "Actions";
  }
}

export function groupSearchResults(
  results: SearchResult[],
): SearchResultSection[] {
  const resultsBySection = new Map<SearchResultSectionKey, SearchResult[]>();

  for (const result of results) {
    const sectionKey = getResultSectionKey(result);
    const sectionResults = resultsBySection.get(sectionKey) ?? [];
    sectionResults.push(result);
    resultsBySection.set(sectionKey, sectionResults);
  }

  return SEARCH_RESULT_SECTION_ORDER.flatMap((sectionKey) => {
    const sectionResults = resultsBySection.get(sectionKey);

    if (!sectionResults || sectionResults.length === 0) {
      return [];
    }

    return [
      {
        key: sectionKey,
        results: sectionResults,
        title: getSectionTitle(sectionKey),
      },
    ];
  });
}

export function getSuggestedSearchResults(channels: Channel[]) {
  return channels
    .filter(
      (channel) =>
        !channel.archivedAt &&
        (channel.isMember || channel.channelType === "dm"),
    )
    .sort((a, b) => {
      const activityDiff =
        getChannelActivityTime(b) - getChannelActivityTime(a);
      if (activityDiff !== 0) {
        return activityDiff;
      }

      const typeRank = (channel: Channel) =>
        channel.channelType === "dm"
          ? 0
          : channel.channelType === "stream"
            ? 1
            : 2;
      const rankDiff = typeRank(a) - typeRank(b);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_SEARCH_SUGGESTIONS)
    .map((channel) => ({
      kind: "channel" as const,
      channel,
    }));
}
