import * as React from "react";

import { setChannelLensCounts } from "@/features/channels/channelLensCountsStore";
import { useChannelViewTab } from "@/features/channels/channelViewTabStore";
import {
  selectChannelCodeArtifacts,
  selectChannelFileArtifacts,
} from "@/features/channels/lib/channelLensData";
import { ChannelLensView } from "./ChannelLensView";
import { ChannelPane } from "./ChannelScreenLazyViews";

/**
 * Routes a channel to whichever lens is being read, and publishes the counts
 * its tab bar shows.
 *
 * The switch lives here, at the seam, rather than inside `ChannelPane`: the
 * pane owns the conversation — its scroll anchoring, its read markers, its
 * composer — and none of that survives being conditionally unmounted around a
 * tab change. Keeping the branch outside means each lens mounts and unmounts
 * whole, and the conversation is rebuilt from scratch when the reader returns,
 * which is the same path as arriving from another channel.
 *
 * The counts are published from here for the same reason the branch is here:
 * this is the one place that holds the channel's messages no matter which tab
 * is open. Computing them inside a lens would leave the badges blank on the
 * conversation, which is the tab people are actually on.
 */
export function GuardedChannelPane(
  props: React.ComponentProps<typeof ChannelPane>,
) {
  const channelId = props.activeChannel?.id ?? null;
  const tab = useChannelViewTab(channelId);

  usePublishedLensCounts(channelId, props.messages, props.threadSummaries);

  if (tab !== "all") {
    return <ChannelLensView {...props} />;
  }

  return <ChannelPane {...props} />;
}

/**
 * A thread is a root somebody replied to, and an artifact is a diff or an
 * attachment — the same definitions the Threads and Artifacts tabs use, so a
 * badge can never disagree with the list it leads to.
 */
function usePublishedLensCounts(
  channelId: string | null,
  messages: React.ComponentProps<typeof ChannelPane>["messages"],
  threadSummaries: React.ComponentProps<typeof ChannelPane>["threadSummaries"],
) {
  const threads = React.useMemo(() => {
    if (!threadSummaries) return 0;
    let count = 0;
    for (const summary of threadSummaries.values()) {
      if (summary.replyCount > 0) count += 1;
    }
    return count;
  }, [threadSummaries]);

  const artifacts = React.useMemo(
    () =>
      selectChannelCodeArtifacts(messages).length +
      selectChannelFileArtifacts(messages).length,
    [messages],
  );

  React.useEffect(() => {
    if (!channelId) return;
    setChannelLensCounts(channelId, { artifacts, threads });
  }, [artifacts, channelId, threads]);
}
