import * as React from "react";

import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import {
  resultIcon,
  resultTestId,
  type SearchResult,
} from "@/features/search/ui/SearchResultItem";
import {
  formatRelativeTime,
  getChannelDisplayName,
  getChannelPreview,
  getChannelSuggestionMeta,
  getSearchHitContextLabel,
  getUserDisplayName,
  getUserSecondaryLabel,
  type SearchHitContextLabel,
  truncateResultText,
} from "@/features/search/ui/searchResultFormatting";
import type { Channel } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import {
  MENTION_CHIP_BASE_CLASSES,
  MESSAGE_MARKDOWN_CLASS,
} from "@/shared/ui/mentionChip";
import { UserAvatar } from "@/shared/ui/UserAvatar";

export function SearchHitContextLine({
  label,
}: {
  label: SearchHitContextLabel;
}) {
  return (
    <span
      className={cn(
        MESSAGE_MARKDOWN_CLASS,
        "mt-0 flex min-w-0 items-center gap-1.5 text-2xs font-medium leading-3 text-muted-foreground/80",
      )}
    >
      <span className="shrink-0">{label.text}</span>
      {label.channelLabel ? (
        <span
          className={cn(
            MENTION_CHIP_BASE_CLASSES,
            "search-channel-chip min-w-0 max-w-full overflow-hidden",
          )}
          data-channel-link=""
        >
          <span className="truncate">#{label.channelLabel}</span>
        </span>
      ) : null}
    </span>
  );
}

type SearchResultRowProps = {
  channelLabels?: Record<string, string>;
  channelLookup: ReadonlyMap<string, Channel>;
  currentPubkey?: string;
  isSelected: boolean;
  menuIndex: number;
  onMouseEnter: () => void;
  onSelect: () => void;
  result: SearchResult;
  resultProfiles: UserProfileLookup | undefined;
};

export function SearchResultRow({
  channelLabels,
  channelLookup,
  currentPubkey,
  isSelected,
  menuIndex,
  onMouseEnter,
  onSelect,
  result,
  resultProfiles,
}: SearchResultRowProps) {
  const channelDisplayName =
    result.kind === "channel"
      ? getChannelDisplayName(result.channel, channelLabels)
      : null;
  const userDisplayName =
    result.kind === "user" ? getUserDisplayName(result.user) : null;
  const messageAuthorLabel =
    result.kind === "message"
      ? resolveUserLabel({
          currentPubkey,
          profiles: resultProfiles,
          pubkey: result.hit.pubkey,
          preferResolvedSelfLabel: true,
        })
      : null;
  const messageContextLabel =
    result.kind === "message"
      ? getSearchHitContextLabel(result.hit, channelLookup, channelLabels)
      : null;
  const title =
    result.kind === "channel"
      ? channelDisplayName
      : result.kind === "action"
        ? result.action.title
        : result.kind === "user"
          ? userDisplayName
          : messageAuthorLabel;
  const preview =
    result.kind === "channel"
      ? getChannelPreview(result.channel)
      : result.kind === "action"
        ? result.action.description
        : result.kind === "user"
          ? getUserSecondaryLabel(result.user)
          : truncateResultText(result.hit.content);
  const trailingLabel =
    result.kind === "channel"
      ? getChannelSuggestionMeta(result.channel)
      : result.kind === "message"
        ? formatRelativeTime(result.hit.createdAt)
        : null;

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "search-result-row flex w-full gap-3 rounded-lg px-2.5 text-left transition-colors",
        result.kind === "message" ? "items-start" : "items-center",
        result.kind === "message" ? "py-3.5" : "py-2.5",
        isSelected ? "bg-muted/45 text-foreground" : "hover:bg-muted/35",
      )}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      role="option"
      type="button"
      data-testid={resultTestId(result)}
      data-search-result-index={menuIndex}
    >
      {result.kind === "message" ? (
        <UserAvatar
          avatarUrl={
            resultProfiles?.[result.hit.pubkey.toLowerCase()]?.avatarUrl ?? null
          }
          className="h-8 w-8"
          displayName={resolveUserLabel({
            currentPubkey,
            profiles: resultProfiles,
            pubkey: result.hit.pubkey,
            preferResolvedSelfLabel: true,
          })}
          size="md"
        />
      ) : result.kind === "user" ? (
        <UserAvatar
          avatarUrl={result.user.avatarUrl}
          className="h-7 w-7"
          displayName={userDisplayName ?? result.user.pubkey}
          size="sm"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/70 text-muted-foreground">
          {React.createElement(resultIcon(result, channelLookup), {
            className: "h-4 w-4",
          })}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {result.kind === "message" ? (
          <span className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3">
            <span className="col-start-1 row-start-1 min-w-0 truncate text-sm font-semibold leading-4 text-foreground">
              {title}
            </span>
            {trailingLabel ? (
              <span className="col-start-2 row-start-1 flex shrink-0 items-center justify-self-end text-xs font-medium leading-4 text-muted-foreground/70">
                {trailingLabel}
              </span>
            ) : null}
            {messageContextLabel ? (
              <span className="col-start-1 min-w-0">
                <SearchHitContextLine label={messageContextLabel} />
              </span>
            ) : null}
            {preview ? (
              <span className="col-start-1 mt-1.5 block min-w-0 truncate text-sm leading-5 text-muted-foreground">
                {preview}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="block space-y-0.5">
            <span className="block truncate text-sm font-semibold">
              {title}
            </span>
            {preview ? (
              <span className="block truncate text-xs text-muted-foreground">
                {preview}
              </span>
            ) : null}
          </span>
        )}
      </span>
      {result.kind !== "message" && trailingLabel ? (
        <span className="shrink-0 text-2xs text-muted-foreground/75">
          {trailingLabel}
        </span>
      ) : null}
    </button>
  );
}
