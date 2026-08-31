import { AtSign, Bell, CheckCheck, ShieldCheck } from "lucide-react";
import * as React from "react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import { useChannelsQuery } from "@/features/channels/hooks";
import { useHomeFeedQuery } from "@/features/home/hooks";
import { useFeedItemState } from "@/features/home/useFeedItemState";
import {
  setNeedsYouShowMentions,
  useNeedsYouShowMentions,
} from "@/features/sidebar/lib/sidebarNeedsYouPrefs";
import {
  formatCompactAge,
  selectNeedsYouRows,
  type NeedsYouRow,
} from "@/features/sidebar/lib/sidebarNowData";
import { useIdentityQuery } from "@/shared/api/hooks";
import { cn } from "@/shared/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

const POPOVER_ROW_LIMIT = 8;

function rowIcon(row: NeedsYouRow) {
  if (row.isApproval) return ShieldCheck;
  return row.category === "mention" ? AtSign : Bell;
}

/**
 * The notification bell: Needs-you as title-bar chrome instead of a standing
 * sidebar block.
 *
 * Same data, same rules as the old sidebar section (`selectNeedsYouRows`):
 * approvals first and never auto-dismissed, opening an item marks it read,
 * the mentions display preference filters here too. Self-sufficient on
 * purpose — every query it mounts joins an existing React Query cache entry,
 * so the bell costs no extra fetches and needs no props from the shell.
 */
export function NotificationsBell({
  triggerClassName,
}: {
  triggerClassName?: string;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const identityQuery = useIdentityQuery();
  const currentPubkey = identityQuery.data?.pubkey;
  const homeFeedQuery = useHomeFeedQuery();
  const { doneSet, markDone, markManyDone } = useFeedItemState(currentPubkey);
  const showMentions = useNeedsYouShowMentions();
  const channelsQuery = useChannelsQuery();
  const { goChannel, goHome } = useAppNavigation();

  const channelIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const channel of channelsQuery.data ?? []) ids.add(channel.id);
    return ids;
  }, [channelsQuery.data]);

  const feed = homeFeedQuery.data?.feed;
  const needsYou = React.useMemo(
    () =>
      selectNeedsYouRows({
        needsAction: feed?.needsAction,
        mentions: feed?.mentions,
        doneIds: doneSet,
        hideMentions: !showMentions,
        limit: POPOVER_ROW_LIMIT,
      }),
    [doneSet, feed?.mentions, feed?.needsAction, showMentions],
  );

  const handleSelect = React.useCallback(
    (row: NeedsYouRow) => {
      // Opening an item is reading it — except approvals, which stay until
      // acted on: navigating to one is not resolving it.
      if (!row.isApproval) markDone(row.id);
      setOpen(false);
      if (row.channelId && channelIds.has(row.channelId)) {
        void goChannel(row.channelId);
        return;
      }
      void goHome();
    },
    [channelIds, goChannel, goHome, markDone],
  );

  const nowMs = Date.now();
  const badgeCount = needsYou.totalCount;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={
            badgeCount > 0
              ? `Notifications (${badgeCount} pending)`
              : "Notifications"
          }
          className={cn(
            "relative flex items-center justify-center",
            triggerClassName,
          )}
          data-testid="notifications-bell"
          type="button"
        >
          <Bell className="size-[16px]" />
          {badgeCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-3xs font-semibold leading-none tabular-nums text-primary-foreground"
              data-testid="notifications-bell-badge"
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        data-testid="notifications-popover"
        sideOffset={6}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            Notifications
          </span>
          {needsYou.clearableIds.length > 0 ? (
            <button
              aria-label="Clear all"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="notifications-clear-all"
              onClick={() => markManyDone(needsYou.clearableIds)}
              title="Clear all (approvals stay)"
              type="button"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {needsYou.rows.length === 0 ? (
          <p
            className="px-3 py-6 text-center text-sm text-muted-foreground"
            data-testid="notifications-empty"
          >
            {showMentions
              ? "Nothing pending · all caught up"
              : "Nothing pending · mentions hidden"}
          </p>
        ) : (
          <div className="max-h-[min(60vh,22rem)] overflow-y-auto p-1">
            {needsYou.rows.map((row) => {
              const Icon = rowIcon(row);
              return (
                <button
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="notifications-row"
                  key={row.id}
                  onClick={() => handleSelect(row)}
                  type="button"
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      row.isApproval ? "text-amber-500" : "text-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        {formatCompactAge(row.createdAt, nowMs)}
                      </span>
                    </span>
                    {row.snippet ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.snippet}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
            {needsYou.hiddenCount > 0 ? (
              <button
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                data-testid="notifications-more"
                onClick={() => {
                  setOpen(false);
                  void goHome();
                }}
                type="button"
              >
                {needsYou.hiddenCount} more in Home
              </button>
            ) : null}
          </div>
        )}
        <div className="border-t border-border/60 px-3 py-1.5">
          <button
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            data-testid="notifications-toggle-mentions"
            onClick={() => setNeedsYouShowMentions(!showMentions)}
            type="button"
          >
            {showMentions ? "Hide mentions" : "Show mentions"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
