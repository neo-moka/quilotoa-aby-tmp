import * as React from "react";

/**
 * Which lens a channel is being read through.
 *
 * `all` is the conversation itself — the surface that existed before these
 * tabs. The other three are projections *of the same channel*, not separate
 * places: `work` is the agent runs happening here, `threads` is the questions
 * still open here, `artifacts` is what the work produced here. That framing is
 * why the tab is per-channel state and not a global preference — "I was reading
 * the work in #product-eng" should survive a trip to another channel and back,
 * while a different channel opens on its conversation like always.
 */
export type ChannelViewTab = "all" | "work" | "threads" | "artifacts";

export const CHANNEL_VIEW_TABS: readonly ChannelViewTab[] = [
  "all",
  "work",
  "threads",
  "artifacts",
];

const DEFAULT_TAB: ChannelViewTab = "all";

type Snapshot = Readonly<Record<string, ChannelViewTab>>;

/**
 * A store rather than a URL search param because the tab is a reading posture,
 * not a location: deep links into a channel (`buzz://message?…`, notifications,
 * search results) all target a message in the conversation, and a param would
 * force every one of those call sites to also decide a tab. Mirrors
 * `features/agents/agentActivityPanelStore.ts`, the app's existing precedent
 * for cross-route view state.
 *
 * Channel-scoped, therefore community-scoped: reset in `resetCommunityState`,
 * or a channel id from the previous community keeps its tab here forever.
 */
let snapshot: Snapshot = {};
const listeners = new Set<() => void>();

function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function setChannelViewTab(channelId: string, tab: ChannelViewTab) {
  if (getChannelViewTab(channelId) === tab) return;
  // `all` is the default, so storing it would only grow the map without
  // changing what anyone reads.
  if (tab === DEFAULT_TAB) {
    if (!(channelId in snapshot)) return;
    const { [channelId]: _dropped, ...rest } = snapshot;
    publish(rest);
    return;
  }
  publish({ ...snapshot, [channelId]: tab });
}

export function getChannelViewTab(channelId: string | null): ChannelViewTab {
  if (!channelId) return DEFAULT_TAB;
  return snapshot[channelId] ?? DEFAULT_TAB;
}

/**
 * Reading the tab for whichever channel is open.
 *
 * Subscribes to the whole map and narrows in the selector, which is correct
 * here: the map only changes when someone switches a tab, so a channel that is
 * not the open one cannot cause a render.
 */
export function useChannelViewTab(channelId: string | null): ChannelViewTab {
  const subscribe = React.useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const read = React.useCallback(
    () => getChannelViewTab(channelId),
    [channelId],
  );
  return React.useSyncExternalStore(subscribe, read, read);
}

/** Community-scoped reset — wired into `resetCommunityState`. */
export function resetChannelViewTabStore() {
  snapshot = {};
  for (const listener of listeners) listener();
}
