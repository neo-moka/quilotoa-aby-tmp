import * as React from "react";

export type ChannelLensCounts = {
  artifacts: number;
  threads: number;
};

const EMPTY: ChannelLensCounts = { artifacts: 0, threads: 0 };

type Snapshot = Readonly<Record<string, ChannelLensCounts>>;

/**
 * The tab badges' numbers, published by whoever is rendering the channel.
 *
 * The header shows the counts but cannot compute them: threads and artifacts
 * are derived from the channel's loaded messages, which only the pane below
 * the header receives. Re-fetching that window in the header to decorate two
 * badges would double the work for a pair of small numbers, and lifting the
 * message state up would mean growing `ChannelScreen` and `ChannelPane`, both
 * of which are already at the repo's file-size ceiling.
 *
 * So the pane publishes and the header subscribes. The direction is deliberate:
 * a count is a fact about what was loaded, and the component that loaded it is
 * the only one that can state it honestly.
 */
let snapshot: Snapshot = {};
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setChannelLensCounts(
  channelId: string,
  counts: ChannelLensCounts,
) {
  const current = snapshot[channelId];
  if (
    current &&
    current.artifacts === counts.artifacts &&
    current.threads === counts.threads
  ) {
    return;
  }
  publish({ ...snapshot, [channelId]: counts });
}

export function getChannelLensCounts(
  channelId: string | null,
): ChannelLensCounts | null {
  if (!channelId) return null;
  return snapshot[channelId] ?? null;
}

/**
 * Reads the counts for one channel.
 *
 * `null` until the pane has published, which is what keeps a badge from
 * flashing a zero on the way to its real number — the tab bar treats "not
 * counted yet" and "counted zero" differently on purpose.
 */
export function useChannelLensCounts(
  channelId: string | null,
): ChannelLensCounts | null {
  const subscribe = React.useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const read = React.useCallback(
    () => getChannelLensCounts(channelId),
    [channelId],
  );
  return React.useSyncExternalStore(subscribe, read, read);
}

export { EMPTY as EMPTY_CHANNEL_LENS_COUNTS };

/** Community-scoped reset — wired into `resetCommunityState`. */
export function resetChannelLensCountsStore() {
  snapshot = {};
  for (const listener of listeners) listener();
}
