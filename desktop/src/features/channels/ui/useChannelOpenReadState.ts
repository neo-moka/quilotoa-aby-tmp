import * as React from "react";

import { useAppShell } from "@/app/AppShellContext";
import { useChannelViewTab } from "@/features/channels/channelViewTabStore";
import { isThreadReply } from "@/features/messages/lib/threading";
import type { FeedItem } from "@/shared/api/types";

/**
 * Inbox overrides for top-level rows are consumed by opening the channel.
 * Thread-reply overrides intentionally remain until their thread is read.
 */
export function getTopLevelInboxUnreadOverrideIds(
  items: FeedItem[],
  channelId: string,
): string[] {
  return items.flatMap((item) =>
    item.channelId === channelId && !isThreadReply(item.tags) ? [item.id] : [],
  );
}

export function useChannelOpenReadState(
  activeChannelId: string | null,
  isChannelMember: boolean | undefined,
  activeReadAt: string | null,
) {
  const { feedItemState, locallyUnreadFeedItems, markChannelRead } =
    useAppShell();
  const tab = useChannelViewTab(activeChannelId);

  React.useEffect(() => {
    if (!activeChannelId || isChannelMember === false) return;
    // Opening a channel is only "reading" it when the conversation is what
    // opened. The other lenses show runs, threads and artifacts — none of them
    // put a message on screen, so clearing the unread marker from one would
    // lose the reader's place in a conversation they never saw. Switching back
    // re-runs this effect and marks it read then, which is when they did.
    if (tab !== "all") return;
    for (const itemId of getTopLevelInboxUnreadOverrideIds(
      locallyUnreadFeedItems,
      activeChannelId,
    )) {
      feedItemState.undoUnread(itemId);
    }
    markChannelRead(activeChannelId, activeReadAt, { topLevelOnly: true });
  }, [
    activeChannelId,
    activeReadAt,
    feedItemState.undoUnread,
    isChannelMember,
    locallyUnreadFeedItems,
    markChannelRead,
    tab,
  ]);
}
