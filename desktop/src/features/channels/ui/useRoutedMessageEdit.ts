import * as React from "react";

import { isThreadReply } from "@/features/messages/lib/threading";
import type { TimelineMessage } from "@/features/messages/types";
import type { MessageComposerEditTarget } from "@/features/messages/ui/MessageComposer.types";
import { KIND_SYSTEM_MESSAGE } from "@/shared/constants/kinds";
import { toast } from "@/shared/ui/toast";

type TimelineEntryLike = { message: TimelineMessage };

/**
 * Routing for "edit this message" gestures across the pane's two columns.
 *
 * An edit can be asked for from the main timeline, from a thread, or from the
 * keyboard ("edit my last message") — but only one composer can hold an edit
 * at a time, and on narrow layouts the main composer is not even mounted while
 * a thread covers it. This hook owns all of that: it refuses a cross-column
 * edit while another is in flight, and when the main timeline's composer is
 * covered it parks the request, closes the thread, and flushes the parked edit
 * once the composer exists again.
 *
 * The parked edit lives in a ref, not state — it is a handoff, not something
 * to render — and it is invalidated when the channel changes or the reader
 * lands in a different thread, so an edit parked in one room can never open a
 * composer in another.
 */
export function useRoutedMessageEdit({
  activeChannelId,
  channelIsCovered,
  currentPubkey,
  editTarget,
  isSinglePanelView,
  mainTimelineEntries,
  onCloseThread,
  onEdit,
  threadHeadMessage,
  threadMessages,
  useFocusThreadDrawer,
}: {
  activeChannelId: string | null;
  channelIsCovered: boolean;
  currentPubkey?: string;
  editTarget: MessageComposerEditTarget | null;
  isSinglePanelView: boolean;
  mainTimelineEntries: readonly TimelineEntryLike[];
  onCloseThread: () => void;
  onEdit?: (message: TimelineMessage) => void;
  threadHeadMessage: TimelineMessage | null;
  threadMessages: readonly TimelineEntryLike[];
  useFocusThreadDrawer: boolean;
}): {
  handleRoutedEdit: (message: TimelineMessage) => boolean;
  handleEditLastOwnMainMessage: () => boolean;
  handleEditLastOwnThreadMessage: () => boolean;
} {
  const findLastOwnEditable = React.useCallback(
    (candidates: TimelineMessage[]): TimelineMessage | null => {
      if (!onEdit || !currentPubkey) return null;
      let best: TimelineMessage | null = null;
      for (const message of candidates) {
        if (
          message.kind === KIND_SYSTEM_MESSAGE ||
          message.pubkey !== currentPubkey ||
          message.pending
        ) {
          continue;
        }
        if (!best || message.createdAt >= best.createdAt) {
          best = message;
        }
      }
      return best;
    },
    [onEdit, currentPubkey],
  );

  const pendingMainEditRef = React.useRef<TimelineMessage | null>(null);
  const editTargetRef = React.useRef(editTarget);
  editTargetRef.current = editTarget;
  const pendingMainEditContextRef = React.useRef({
    channelId: activeChannelId,
    threadId: threadHeadMessage?.id ?? null,
  });
  const pendingMainEditContext = {
    channelId: activeChannelId,
    threadId: threadHeadMessage?.id ?? null,
  };
  const previousPendingContext = pendingMainEditContextRef.current;
  if (
    previousPendingContext.channelId !== pendingMainEditContext.channelId ||
    (previousPendingContext.threadId !== null &&
      pendingMainEditContext.threadId !== null &&
      previousPendingContext.threadId !== pendingMainEditContext.threadId)
  ) {
    pendingMainEditRef.current = null;
  }
  pendingMainEditContextRef.current = pendingMainEditContext;

  const handleRoutedEdit = React.useCallback(
    (message: TimelineMessage): boolean => {
      const currentEditTarget = editTargetRef.current;
      if (
        currentEditTarget &&
        currentEditTarget.id !== message.id &&
        currentEditTarget.isThreadReply !== isThreadReply(message.tags ?? [])
      ) {
        pendingMainEditRef.current = null;
        toast.info("Finish or cancel your edit first.");
        return false;
      }
      if (currentEditTarget?.id === message.id) {
        pendingMainEditRef.current = null;
        onEdit?.(message);
        return true;
      }
      if (
        !isThreadReply(message.tags ?? []) &&
        (isSinglePanelView || useFocusThreadDrawer)
      ) {
        pendingMainEditRef.current = message;
        onCloseThread();
        return true;
      }
      onEdit?.(message);
      return Boolean(onEdit);
    },
    [isSinglePanelView, onCloseThread, onEdit, useFocusThreadDrawer],
  );

  const handleEditLastOwnMainMessage = React.useCallback((): boolean => {
    const target = findLastOwnEditable(
      mainTimelineEntries.map((entry) => entry.message),
    );
    return target ? handleRoutedEdit(target) : false;
  }, [findLastOwnEditable, handleRoutedEdit, mainTimelineEntries]);

  const handleEditLastOwnThreadMessage = React.useCallback((): boolean => {
    const scope: TimelineMessage[] = [];
    if (threadHeadMessage) scope.push(threadHeadMessage);
    for (const entry of threadMessages) scope.push(entry.message);
    const target = findLastOwnEditable(scope);
    return target ? handleRoutedEdit(target) : false;
  }, [
    findLastOwnEditable,
    handleRoutedEdit,
    threadHeadMessage,
    threadMessages,
  ]);

  React.useEffect(() => {
    const pendingMainEdit = pendingMainEditRef.current;
    if (!pendingMainEdit || isSinglePanelView || channelIsCovered) return;
    pendingMainEditRef.current = null;
    onEdit?.(pendingMainEdit);
  }, [channelIsCovered, isSinglePanelView, onEdit]);

  return {
    handleRoutedEdit,
    handleEditLastOwnMainMessage,
    handleEditLastOwnThreadMessage,
  };
}
