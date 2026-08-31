import type { QueryClient } from "@tanstack/react-query";

import {
  channelMessagesKey,
  channelWindowKey,
} from "@/features/messages/lib/messageQueryKeys";
import {
  buildReplyTags,
  normalizeMentionPubkeys,
  resolveReplyRootId,
} from "@/features/messages/lib/threading";
import { projectChannelWindowMessages } from "@/features/messages/lib/projectChannelWindow";
import { buildSentFromThreadTag } from "@/features/messages/lib/sentFromThread";
import {
  type ChannelWindowStore,
  emptyChannelWindowStore,
  mergeLiveChannelWindowEvent,
} from "@/features/messages/lib/channelWindowStore";
import { KIND_STREAM_MESSAGE } from "@/shared/constants/kinds";
import type { Identity, RelayEvent } from "@/shared/api/types";

export function createOptimisticMessage(
  channelId: string,
  content: string,
  identity: Identity,
  currentMessages: RelayEvent[],
  mentionPubkeys: string[] = [],
  parentEventId: string | null = null,
  mediaTags: string[][] = [],
  sentFromThreadRootId: string | null = null,
  sentFromThreadRootExcerpt: string | null = null,
): RelayEvent {
  const localKey = `optimistic-${crypto.randomUUID()}`;
  const tags: string[][] = [];

  if (parentEventId) {
    tags.push(
      ...buildReplyTags(
        channelId,
        identity.pubkey,
        parentEventId,
        resolveReplyRootId(parentEventId, currentMessages),
        mentionPubkeys,
      ),
    );
  } else {
    tags.push(["h", channelId]);
    tags.push(["p", identity.pubkey]);
    for (const pubkey of normalizeMentionPubkeys(
      mentionPubkeys,
      identity.pubkey,
    )) {
      tags.push(["p", pubkey]);
    }
  }

  for (const tag of mediaTags) {
    tags.push(tag);
  }
  if (sentFromThreadRootId) {
    tags.push(
      buildSentFromThreadTag(sentFromThreadRootId, sentFromThreadRootExcerpt),
    );
  }

  return {
    id: localKey,
    localKey,
    pubkey: identity.pubkey,
    created_at: Math.floor(Date.now() / 1_000),
    kind: KIND_STREAM_MESSAGE,
    tags,
    content,
    sig: "",
    pending: true,
  };
}

/**
 * Inserts a pending outgoing row into a channel's timeline *before* the send
 * mutation runs.
 *
 * The composer's send path can spend seconds in preflight when agents are
 * mentioned (starting agents, preparing DM channels, huddle sync) — during
 * which the composer is already cleared but nothing shows in the timeline.
 * This puts the row on screen at submit time; the send mutation adopts it via
 * `earlyOptimisticId` so ack/rollback reconciliation stays single-owner.
 * Returns the optimistic id the caller must ferry into the mutation — or
 * remove with {@link removeEarlyOptimisticMessage} on any pre-send abort.
 */
export function insertEarlyOptimisticMessage(
  queryClient: QueryClient,
  channelId: string,
  identity: Identity,
  input: { content: string; mentionPubkeys?: string[] },
): string {
  const previousMessages =
    queryClient.getQueryData<RelayEvent[]>(channelMessagesKey(channelId)) ?? [];
  const optimisticMessage = createOptimisticMessage(
    channelId,
    input.content.trim(),
    identity,
    previousMessages,
    input.mentionPubkeys ?? [],
  );
  const windowKey = channelWindowKey(channelId);
  const previousWindow =
    queryClient.getQueryData<ChannelWindowStore>(windowKey) ??
    emptyChannelWindowStore();
  queryClient.setQueryData(
    windowKey,
    mergeLiveChannelWindowEvent(previousWindow, optimisticMessage),
  );
  projectChannelWindowMessages(queryClient, channelId);
  return optimisticMessage.id;
}

/** Removes an early optimistic row that never reached the send mutation. */
export function removeEarlyOptimisticMessage(
  queryClient: QueryClient,
  channelId: string,
  optimisticId: string,
) {
  const windowKey = channelWindowKey(channelId);
  const current = queryClient.getQueryData<ChannelWindowStore>(windowKey);
  if (!current) return;
  queryClient.setQueryData(windowKey, {
    ...current,
    liveOverlay: current.liveOverlay.filter(
      (event) => event.id !== optimisticId,
    ),
  });
  projectChannelWindowMessages(queryClient, channelId);
}

/**
 * Eligibility gate + insert for the composer's submit moment: top-level,
 * text-only sends into a known channel (attachments keep the upload flow's
 * own progress UI; thread replies use their own pipeline; forums never
 * render pending rows). Returns the handle the caller must either ferry to
 * the send mutation or remove on abort.
 */
export function maybeInsertEarlyOptimisticMessage(
  queryClient: QueryClient,
  identity: Identity | undefined,
  input: {
    channelId: string | null;
    channelType: string | null;
    content: string;
    hasAttachments: boolean;
    isThreadReply: boolean;
    mentionPubkeys: string[];
  },
): { channelId: string; id: string } | null {
  if (
    !identity ||
    !input.channelId ||
    input.isThreadReply ||
    input.hasAttachments ||
    input.content.length === 0 ||
    input.channelType === "forum"
  ) {
    return null;
  }
  return {
    channelId: input.channelId,
    id: insertEarlyOptimisticMessage(queryClient, input.channelId, identity, {
      content: input.content,
      mentionPubkeys: input.mentionPubkeys,
    }),
  };
}
