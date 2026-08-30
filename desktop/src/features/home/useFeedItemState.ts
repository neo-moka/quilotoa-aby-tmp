import * as React from "react";

const DONE_STORAGE_KEY = "buzz-home-feed-done.v1";
const UNREAD_STORAGE_KEY = "buzz-home-feed-unread.v1";
const MAX_ITEMS = 500;

/**
 * Same-window sync channel between hook instances.
 *
 * Home and the sidebar's Needs-you block each mount their own
 * `useFeedItemState`; before this event, marking an item done in one place
 * only reached the other on remount (the `storage` event fires in OTHER
 * windows, never this one). Every localStorage write that changes bytes
 * dispatches this event, and every instance re-reads on it — the
 * bytes-changed guard on both sides is what keeps two instances from
 * ping-ponging writes forever.
 */
const FEED_ITEM_STATE_SYNC_EVENT = "buzz:feed-item-state-sync";

function doneStorageKey(pubkey: string) {
  return `${DONE_STORAGE_KEY}:${pubkey}`;
}

function unreadStorageKey(pubkey: string) {
  return `${UNREAD_STORAGE_KEY}:${pubkey}`;
}

function readStoredIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((v): v is string => typeof v === "string")
          .slice(-MAX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(ids.slice(-MAX_ITEMS));
  if (window.localStorage.getItem(key) === serialized) return;
  window.localStorage.setItem(key, serialized);
  window.dispatchEvent(new CustomEvent(FEED_ITEM_STATE_SYNC_EVENT));
}

function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function useFeedItemState(pubkey: string | undefined) {
  const normalizedPubkey = pubkey?.trim().toLowerCase() ?? "";
  const key = doneStorageKey(normalizedPubkey);

  const [doneIds, setDoneIds] = React.useState<string[]>(() =>
    readStoredIds(key),
  );
  const [unreadIds, setUnreadIds] = React.useState<string[]>(() =>
    readStoredIds(unreadStorageKey(normalizedPubkey)),
  );
  const [loadedPubkey, setLoadedPubkey] = React.useState(normalizedPubkey);

  React.useEffect(() => {
    setDoneIds(readStoredIds(doneStorageKey(normalizedPubkey)));
    setUnreadIds(readStoredIds(unreadStorageKey(normalizedPubkey)));
    setLoadedPubkey(normalizedPubkey);
  }, [normalizedPubkey]);

  React.useEffect(() => {
    if (loadedPubkey !== normalizedPubkey) return;
    writeStoredIds(doneStorageKey(normalizedPubkey), doneIds);
  }, [loadedPubkey, normalizedPubkey, doneIds]);

  React.useEffect(() => {
    if (loadedPubkey !== normalizedPubkey) return;
    writeStoredIds(unreadStorageKey(normalizedPubkey), unreadIds);
  }, [loadedPubkey, normalizedPubkey, unreadIds]);

  // Re-read on sibling-instance writes. The content-equality bailout keeps
  // state identity stable when this instance is the one that just wrote.
  React.useEffect(() => {
    const resync = () => {
      const nextDone = readStoredIds(doneStorageKey(normalizedPubkey));
      setDoneIds((prev) => (sameIds(prev, nextDone) ? prev : nextDone));
      const nextUnread = readStoredIds(unreadStorageKey(normalizedPubkey));
      setUnreadIds((prev) => (sameIds(prev, nextUnread) ? prev : nextUnread));
    };
    window.addEventListener(FEED_ITEM_STATE_SYNC_EVENT, resync);
    return () => window.removeEventListener(FEED_ITEM_STATE_SYNC_EVENT, resync);
  }, [normalizedPubkey]);

  const doneSet = React.useMemo(() => new Set(doneIds), [doneIds]);
  const unreadSet = React.useMemo(() => new Set(unreadIds), [unreadIds]);

  const markDone = React.useCallback((id: string) => {
    setDoneIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUnreadIds((prev) => prev.filter((v) => v !== id));
  }, []);

  /** Bulk `markDone` — one state pass for "clear all" style gestures. */
  const markManyDone = React.useCallback((ids: Iterable<string>) => {
    const incoming = [...ids];
    if (incoming.length === 0) return;
    const incomingSet = new Set(incoming);
    setDoneIds((prev) => {
      const merged = [...prev, ...incoming.filter((id) => !prev.includes(id))];
      return merged.length === prev.length ? prev : merged;
    });
    setUnreadIds((prev) => prev.filter((v) => !incomingSet.has(v)));
  }, []);

  const undoDone = React.useCallback((id: string) => {
    setDoneIds((prev) => prev.filter((v) => v !== id));
  }, []);

  const markUnread = React.useCallback((id: string) => {
    setDoneIds((prev) => prev.filter((v) => v !== id));
    setUnreadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const undoUnread = React.useCallback((id: string) => {
    setUnreadIds((prev) => prev.filter((v) => v !== id));
  }, []);

  return {
    doneSet,
    markDone,
    markManyDone,
    markUnread,
    undoDone,
    undoUnread,
    unreadSet,
  };
}

export type FeedItemState = ReturnType<typeof useFeedItemState>;
