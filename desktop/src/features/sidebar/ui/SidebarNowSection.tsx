import { CheckCircle2 } from "lucide-react";
import * as React from "react";

import { useChannelsQuery } from "@/features/channels/hooks";
import { useHomeFeedQuery } from "@/features/home/hooks";
import { useFeedItemState } from "@/features/home/useFeedItemState";
import {
  selectNeedsYouRows,
  SIDEBAR_NOW_ROW_LIMIT,
  type NeedsYouRow as NeedsYouRowData,
} from "@/features/sidebar/lib/sidebarNowData";
import { useSidebarView } from "@/features/sidebar/lib/sidebarViewStore";
import { SidebarNeedsYouRow } from "@/features/sidebar/ui/SidebarNeedsYouRow";
import { SidebarSectionHeading } from "@/features/sidebar/ui/SidebarSectionHeading";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/sidebar";

type SidebarNowSectionProps = {
  currentPubkey?: string;
  onSelectChannel: (channelId: string) => void;
  onSelectHome: () => void;
  selectedChannelId: string | null;
};

/**
 * What is waiting on the reader, at the top of the sidebar.
 *
 * This block used to also carry a "Live" section of working-agent cards; it
 * was removed as triple coverage once the same fact showed in three places at
 * once — the channel row's working badge, the agent rail on the channel's
 * right edge, and here. Needs-you has no such duplicate: it is the one block
 * that answers "where should I go?" rather than "where can I go?".
 *
 * It holds its shape when empty rather than disappearing. A section that
 * vanishes takes its own discoverability with it: the reader never learns the
 * app tracks this, so on the day something *is* waiting they have no habit of
 * looking. "All caught up" is a useful answer rather than an absence.
 *
 * Self-sufficient by design. Every query it mounts is already mounted
 * elsewhere under the same React Query key (`home-feed`, `channels`), so
 * subscribing here joins a cache entry rather than opening a second fetch.
 */
export function SidebarNowSection({
  currentPubkey,
  onSelectChannel,
  onSelectHome,
  selectedChannelId,
}: SidebarNowSectionProps): React.ReactElement | null {
  const view = useSidebarView();
  const homeFeedQuery = useHomeFeedQuery();
  const { doneSet } = useFeedItemState(currentPubkey);
  const channelsQuery = useChannelsQuery();
  void selectedChannelId;

  const channels = channelsQuery.data;
  const channelIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const channel of channels ?? []) ids.add(channel.id);
    return ids;
  }, [channels]);

  const feed = homeFeedQuery.data?.feed;
  const needsYou = React.useMemo(
    () =>
      selectNeedsYouRows({
        needsAction: feed?.needsAction,
        mentions: feed?.mentions,
        doneIds: doneSet,
        limit: SIDEBAR_NOW_ROW_LIMIT,
      }),
    [doneSet, feed?.mentions, feed?.needsAction],
  );

  const handleSelectNeedsYou = React.useCallback(
    (row: NeedsYouRowData) => {
      // Items whose channel is gone (or was never in this community) still have
      // somewhere to land: Home renders the full item with its context.
      if (row.channelId && channelIds.has(row.channelId)) {
        onSelectChannel(row.channelId);
        return;
      }
      onSelectHome();
    },
    [channelIds, onSelectChannel, onSelectHome],
  );

  // "Rooms" and "People" are deliberate narrowings to the channel and DM
  // lists; this block is the overview those two filter away.
  if (view !== "now") return null;

  return (
    <div data-testid="sidebar-now-section">
      <SidebarGroup className="select-none gap-1">
        <SidebarSectionHeading
          count={needsYou.totalCount}
          label="Needs you"
          testId="sidebar-needs-you-heading"
        />
        <SidebarGroupContent>
          {needsYou.rows.length === 0 ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1 text-2xs text-sidebar-foreground/50"
              data-testid="sidebar-needs-you-empty"
            >
              <CheckCircle2
                aria-hidden="true"
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <span className="truncate">Nothing pending · all caught up</span>
            </div>
          ) : (
            <SidebarMenu>
              {needsYou.rows.map((row) => (
                <SidebarNeedsYouRow
                  key={row.id}
                  onSelect={handleSelectNeedsYou}
                  row={row}
                />
              ))}
              {needsYou.hiddenCount > 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    data-testid="sidebar-needs-you-more"
                    onClick={onSelectHome}
                    size="sm"
                    type="button"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {needsYou.hiddenCount} more
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}
