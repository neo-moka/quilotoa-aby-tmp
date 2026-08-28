import { Search } from "lucide-react";
import * as React from "react";

import { getMinimumSearchQueryLength } from "@/features/search/hooks";
import { useSearchResults } from "@/features/search/useSearchResults";
import {
  resultKey,
  type SearchResult,
} from "@/features/search/ui/SearchResultItem";
import { SearchResultRow } from "@/features/search/ui/SearchResultRow";
import {
  getSuggestedSearchResults,
  groupSearchResults,
  SEARCH_SECTION_TITLE_CLASS,
  type SearchResultSection,
} from "@/features/search/ui/searchResultFormatting";
import { SearchResultsSkeleton } from "@/features/search/ui/SearchResultsSkeleton";
import {
  CurrentChannelSearchAction,
  getChannelScopeLabel,
  SearchDialogInputRow,
} from "@/features/search/ui/SearchScopeControls";
import { useSearchMenuKeyboardNavigation } from "@/features/search/ui/useSearchMenuKeyboardNavigation";
import type { Channel, SearchHit, UserSearchResult } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { useDeferredModalOpen } from "@/shared/ui/deferredModalOpen";

const SEARCH_RESULT_LIMIT = 40;

type TopbarSearchProps = {
  channelLabels?: Record<string, string>;
  channels: Channel[];
  className?: string;
  currentPubkey?: string;
  currentChannelId?: string | null;
  focusRequest?: number;
  onOpenChannel: (channelId: string) => void;
  onOpenResult: (hit: SearchHit) => void;
  onOpenUser?: (user: UserSearchResult) => void | Promise<void>;
  onBrowseChannels?: () => void | Promise<void>;
  onCreateAgent?: () => void | Promise<void>;
  onCreateChannel?: () => void | Promise<void>;
  suggestionChannels?: Channel[];
  scopeFocusRequest?: number;
  variant?: "bar" | "icon";
};

export function TopbarSearch({
  channelLabels,
  channels,
  className,
  currentChannelId,
  currentPubkey,
  focusRequest = 0,
  onOpenChannel,
  onOpenResult,
  onOpenUser,
  onBrowseChannels,
  onCreateAgent,
  onCreateChannel,
  scopeFocusRequest = 0,
  suggestionChannels,
  variant = "bar",
}: TopbarSearchProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [scopeChannelId, setScopeChannelId] = React.useState<string | null>(
    null,
  );
  const [selectedMenuIndex, setSelectedMenuIndex] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dialogInputRef = React.useRef<HTMLInputElement>(null);
  const { cancelDeferredModalOpen, openAfterExit, openNextFrame } =
    useDeferredModalOpen();
  const {
    channelLookup,
    debouncedQuery,
    fuzzyUserCandidatesQuery,
    isWaitingOnFromResolution,
    query,
    resultProfiles,
    results,
    searchQuery,
    setQuery,
    userSearchQuery,
  } = useSearchResults({
    channelLabels,
    channels,
    enabled: isOpen,
    limit: SEARCH_RESULT_LIMIT,
    scopeChannelId,
  });
  const trimmedQuery = query.trim();
  const isIconVariant = variant === "icon";
  const currentChannel = currentChannelId
    ? (channelLookup.get(currentChannelId) ?? null)
    : null;
  const scopeChannel = scopeChannelId
    ? (channelLookup.get(scopeChannelId) ?? null)
    : null;
  const scopeLabel = scopeChannel
    ? getChannelScopeLabel(scopeChannel, channelLabels, currentPubkey)
    : null;
  const currentPubkeyNormalized =
    currentPubkey && normalizePubkey(currentPubkey);
  const hasScopeAction = Boolean(currentChannel && !scopeChannel);
  const suggestedResults = React.useMemo(
    () => getSuggestedSearchResults(suggestionChannels ?? channels),
    [channels, suggestionChannels],
  );
  const suggestionActionResults = React.useMemo(() => {
    const actions: SearchResult[] = [];

    if (onBrowseChannels) {
      actions.push({
        kind: "action",
        action: {
          id: "browse-channels",
          title: "Browse channels",
        },
      });
    }

    if (onCreateChannel) {
      actions.push({
        kind: "action",
        action: {
          id: "create-channel",
          title: "Create a new channel",
        },
      });
    }

    if (onCreateAgent) {
      actions.push({
        kind: "action",
        action: {
          id: "create-agent",
          title: "Create a new agent",
        },
      });
    }

    return actions;
  }, [onBrowseChannels, onCreateAgent, onCreateChannel]);
  const suggestionResults = React.useMemo(
    () => [...suggestedResults, ...suggestionActionResults],
    [suggestedResults, suggestionActionResults],
  );
  const minimumQueryLength = getMinimumSearchQueryLength(scopeChannelId);
  const isShowingSuggestions =
    Math.max(debouncedQuery.length, trimmedQuery.length) < minimumQueryLength;
  const searchableResults = React.useMemo(
    () =>
      results.filter(
        (result) =>
          result.kind !== "user" ||
          normalizePubkey(result.user.pubkey) !== currentPubkeyNormalized,
      ),
    [currentPubkeyNormalized, results],
  );
  const searchResultSections = React.useMemo(
    () => groupSearchResults(searchableResults),
    [searchableResults],
  );
  const groupedSearchResults = React.useMemo(
    () => searchResultSections.flatMap((section) => section.results),
    [searchResultSections],
  );
  const activeResults = isShowingSuggestions
    ? scopeChannel
      ? []
      : suggestionResults
    : groupedSearchResults;
  const isSearchLoading =
    isWaitingOnFromResolution ||
    searchQuery.isLoading ||
    fuzzyUserCandidatesQuery.isLoading ||
    userSearchQuery.isLoading;

  const openSearchDialog = React.useCallback(
    (nextScopeChannelId: string | null = null) => {
      setScopeChannelId(nextScopeChannelId);
      setSelectedMenuIndex(0);
      openNextFrame(() => setIsOpen(true));
    },
    [openNextFrame],
  );

  const handleSearchOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        openSearchDialog(null);
        return;
      }

      cancelDeferredModalOpen();
      setSelectedMenuIndex(0);
      setScopeChannelId(null);
      setIsOpen(false);
    },
    [cancelDeferredModalOpen, openSearchDialog],
  );

  const openResult = React.useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setScopeChannelId(null);
      setQuery("");

      if (result.kind === "channel") {
        onOpenChannel(result.channel.id);
        return;
      }

      if (result.kind === "user") {
        void onOpenUser?.(result.user);
        return;
      }

      if (result.kind === "action") {
        setSelectedMenuIndex(0);
        if (result.action.id === "browse-channels") {
          openAfterExit(() => {
            void onBrowseChannels?.();
          });
        } else if (result.action.id === "create-channel") {
          openAfterExit(() => {
            void onCreateChannel?.();
          });
        } else {
          openAfterExit(() => {
            void onCreateAgent?.();
          });
        }
        return;
      }

      onOpenResult(result.hit);
    },
    [
      onBrowseChannels,
      onCreateAgent,
      onCreateChannel,
      onOpenChannel,
      onOpenResult,
      onOpenUser,
      openAfterExit,
      setQuery,
    ],
  );

  // Edge-trigger: the counter never resets, so `!== 0` would replay on remount.
  const lastFocusRequestRef = React.useRef(focusRequest);
  React.useEffect(() => {
    if (focusRequest === lastFocusRequestRef.current) {
      return;
    }
    lastFocusRequestRef.current = focusRequest;

    openSearchDialog(null);
  }, [focusRequest, openSearchDialog]);

  const lastScopeFocusRequestRef = React.useRef(scopeFocusRequest);
  React.useEffect(() => {
    if (scopeFocusRequest === lastScopeFocusRequestRef.current) {
      return;
    }
    lastScopeFocusRequestRef.current = scopeFocusRequest;

    if (currentChannelId) {
      openSearchDialog(currentChannelId);
    }
  }, [currentChannelId, openSearchDialog, scopeFocusRequest]);

  const focusDialogInput = React.useCallback(() => {
    window.requestAnimationFrame(() => dialogInputRef.current?.focus());
  }, []);

  const activateCurrentChannelScope = React.useCallback(() => {
    if (!currentChannel) return;
    setScopeChannelId(currentChannel.id);
    setSelectedMenuIndex(0);
    focusDialogInput();
  }, [currentChannel, focusDialogInput]);

  const removeChannelScope = React.useCallback(() => {
    setScopeChannelId(null);
    setSelectedMenuIndex(0);
    focusDialogInput();
  }, [focusDialogInput]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      dialogInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isOpen]);

  const handleDialogInputKeyDown = useSearchMenuKeyboardNavigation({
    activeResults,
    hasLeadingAction: hasScopeAction,
    onActivateLeadingAction: activateCurrentChannelScope,
    onOpenResult: openResult,
    onRemoveScope: removeChannelScope,
    query,
    scopeActive: Boolean(scopeChannel),
    selectedMenuIndex,
    setSelectedMenuIndex,
  });

  const renderSearchResultRow = (result: SearchResult, index: number) => {
    const menuIndex = index + (hasScopeAction ? 1 : 0);

    return (
      <SearchResultRow
        channelLabels={channelLabels}
        channelLookup={channelLookup}
        currentPubkey={currentPubkey}
        isSelected={menuIndex === selectedMenuIndex}
        key={resultKey(result)}
        menuIndex={menuIndex}
        onMouseEnter={() => setSelectedMenuIndex(menuIndex)}
        onSelect={() => openResult(result)}
        result={result}
        resultProfiles={resultProfiles}
      />
    );
  };

  const renderSearchResultSections = (sections: SearchResultSection[]) => {
    let resultIndex = 0;

    return sections.map((section) => (
      <div data-search-section={section.key} key={section.key}>
        <div className={SEARCH_SECTION_TITLE_CLASS}>{section.title}</div>
        {section.results.map((result) =>
          renderSearchResultRow(result, resultIndex++),
        )}
      </div>
    ));
  };
  const currentChannelSearchAction =
    currentChannel && !scopeChannel ? (
      <CurrentChannelSearchAction
        channelLabel={getChannelScopeLabel(
          currentChannel,
          channelLabels,
          currentPubkey,
        )}
        channelType={currentChannel.channelType}
        isSelected={selectedMenuIndex === 0}
        onActivate={activateCurrentChannelScope}
        onMouseEnter={() => setSelectedMenuIndex(0)}
      />
    ) : null;
  const searchResultContent = isShowingSuggestions ? (
    scopeChannel ? null : suggestionResults.length === 0 ? (
      <div className="max-h-96 overflow-y-auto">
        {currentChannelSearchAction}
        <div
          className={cn(
            "px-4 text-sm text-muted-foreground",
            currentChannelSearchAction ? "pb-5" : "py-5",
          )}
        >
          <p>No recent activity yet.</p>
        </div>
      </div>
    ) : (
      <div
        aria-label="Recent activity"
        className="max-h-96 overflow-y-auto"
        role="listbox"
      >
        {currentChannelSearchAction}
        <div className="p-1.5">
          {(() => {
            let resultIndex = 0;

            return (
              <>
                {suggestedResults.length > 0 ? (
                  <div>
                    <div className={SEARCH_SECTION_TITLE_CLASS}>
                      Recent activity
                    </div>
                    {suggestedResults.map((result) =>
                      renderSearchResultRow(result, resultIndex++),
                    )}
                  </div>
                ) : null}
                {suggestionActionResults.length > 0 ? (
                  <div>
                    <div className={SEARCH_SECTION_TITLE_CLASS}>Actions</div>
                    {suggestionActionResults.map((result) =>
                      renderSearchResultRow(result, resultIndex++),
                    )}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      </div>
    )
  ) : isSearchLoading && searchableResults.length === 0 ? (
    <div className="max-h-[min(60vh,32rem)] overflow-y-auto">
      {currentChannelSearchAction}
      <SearchResultsSkeleton />
    </div>
  ) : searchQuery.error instanceof Error && searchableResults.length === 0 ? (
    <div className="max-h-[min(60vh,32rem)] overflow-y-auto">
      {currentChannelSearchAction}
      <p
        className={cn(
          "px-4 text-sm text-destructive",
          currentChannelSearchAction ? "pb-5" : "py-5",
        )}
      >
        {searchQuery.error.message}
      </p>
    </div>
  ) : searchableResults.length === 0 ? (
    <div className="max-h-[min(60vh,32rem)] overflow-y-auto">
      {currentChannelSearchAction}
      <p
        className={cn(
          "px-4 text-sm text-muted-foreground",
          currentChannelSearchAction ? "pb-5" : "py-5",
        )}
      >
        No {scopeChannel ? "messages" : "matches"} for{" "}
        <span className="font-semibold">{trimmedQuery}</span>
        {scopeLabel ? (
          <>
            {" "}
            in <span className="font-semibold">{scopeLabel}</span>
          </>
        ) : null}
        .
      </p>
    </div>
  ) : (
    <div
      className="max-h-[min(60vh,32rem)] overflow-y-auto"
      data-testid="search-results-list"
      role="listbox"
    >
      {currentChannelSearchAction}
      <div className="p-1.5">
        {renderSearchResultSections(searchResultSections)}
      </div>
    </div>
  );
  return (
    <div className={cn("relative", className)}>
      <Dialog open={isOpen} onOpenChange={handleSearchOpenChange}>
        <button
          aria-label="Search everything"
          className={
            isIconVariant
              ? "group/search flex size-6 items-center justify-center rounded p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-border/35 hover:text-sidebar-foreground focus-visible:bg-sidebar-border/35 focus-visible:text-sidebar-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              : "group/search flex h-8 w-full items-center gap-2 rounded-md bg-sidebar-border/35 px-2 text-left text-sm text-sidebar-foreground/55 transition-colors duration-150 ease-out hover:bg-sidebar-border/35 hover:text-sidebar-foreground focus-visible:bg-sidebar-border/35 focus-visible:text-sidebar-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          }
          data-testid="open-search"
          onClick={() => openSearchDialog(null)}
          ref={triggerRef}
          title="Search everything"
          type="button"
        >
          <Search
            className={
              isIconVariant
                ? "h-4 w-4 shrink-0"
                : "h-4 w-4 shrink-0 text-sidebar-foreground/45 transition-colors duration-150 ease-out group-hover/search:text-sidebar-foreground/65 group-focus-visible/search:text-sidebar-foreground"
            }
          />
          {isIconVariant ? null : (
            <>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate transition-colors duration-150 ease-out",
                  query
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/55",
                )}
              >
                {query || "Search everything"}
              </span>
              <kbd className="shrink-0 text-2xs text-sidebar-foreground/45">
                &#x2318;K
              </kbd>
            </>
          )}
        </button>
        <DialogContent
          aria-busy={isSearchLoading && searchableResults.length === 0}
          className="mt-[18vh] max-w-2xl self-start gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl"
          data-testid="search-results"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogInputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {scopeLabel ? `Search in ${scopeLabel}` : "Search everything"}
          </DialogTitle>
          <SearchDialogInputRow
            inputRef={dialogInputRef}
            onChange={(nextQuery) => {
              setQuery(nextQuery);
              setSelectedMenuIndex(0);
            }}
            onKeyDown={handleDialogInputKeyDown}
            onRemoveScope={removeChannelScope}
            query={query}
            scopeLabel={scopeLabel}
          />
          {searchResultContent}
        </DialogContent>
      </Dialog>
    </div>
  );
}
