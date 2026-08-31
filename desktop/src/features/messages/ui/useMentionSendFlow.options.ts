import type * as React from "react";

import type { ChannelType } from "@/shared/api/types";
import type { CustomEmoji } from "@/shared/lib/remarkCustomEmoji";
import type { QueuedMediaAttachment } from "@/features/messages/lib/backgroundMediaUploadStore";
import type { UseChannelLinksResult } from "@/features/messages/lib/useChannelLinks";
import type { UseDraftsResult } from "@/features/messages/lib/useDrafts";
import type { UseEmojiAutocompleteResult } from "@/features/messages/lib/useEmojiAutocomplete";
import type { ImetaMedia } from "@/features/messages/lib/imetaMediaMarkdown";
import type { UseMentionsResult } from "@/features/messages/lib/useMentions";
import type { UseRichTextEditorResult } from "@/features/messages/lib/useRichTextEditor";

export type UseMentionSendFlowOptions = {
  channelId: string | null;
  channelLinks: Pick<UseChannelLinksResult, "clearChannels">;
  channelType: ChannelType | null;
  contentRef: React.MutableRefObject<string>;
  customEmoji: CustomEmoji[];
  drafts: Pick<UseDraftsResult, "loadDraft" | "markDraftSent" | "persistDraft">;
  emojiAutocomplete: Pick<UseEmojiAutocompleteResult, "clearEmojis">;
  mentions: UseMentionsResult;
  onPrepareSendChannel?: (pubkeys?: string[]) => Promise<string | null>;
  onAddressedAgentsSendStarted?: (pubkeys: readonly string[]) => void;
  onAddressedAgentsSendFailed?: (pubkeys: readonly string[]) => void;
  onInlineAgentMentionsSent?: (promotion: {
    expectedRevision: number;
    pubkeys: readonly string[];
  }) => void;
  onSendRef: React.MutableRefObject<
    (
      content: string,
      mentionPubkeys: string[],
      mediaTags?: string[][],
      channelId?: string | null,
      threadContext?: {
        parentEventId: string | null;
        threadHeadId: string | null;
      } | null,
      forceRest?: boolean,
      /** Pre-rendered pending row for the mutation to adopt (see hooks.ts). */
      earlyOptimisticId?: string | null,
    ) => Promise<void>
  >;
  richText: Pick<UseRichTextEditorResult, "clearContent" | "setContent">;
  setContent: (content: string) => void;
  setIsEmojiPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingImeta: (pendingImeta: ImetaMedia[]) => void;
  hasUnsavedMedia: () => boolean;
  clearQueuedAttachments: () => void;
  restoreQueuedAttachments: (attachments: QueuedMediaAttachment[]) => void;
  setSpoileredAttachmentUrls?: React.Dispatch<
    React.SetStateAction<Set<string>>
  >;
};
