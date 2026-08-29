import {
  resolveUserLabel,
  type UserProfileLookup,
} from "@/features/profile/lib/identity";
import { normalizePubkey } from "@/shared/lib/pubkey";
import { cn } from "@/shared/lib/cn";
import { Markdown } from "@/shared/ui/markdown";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useAgentSessionTranscriptVariant } from "../agentSessionTranscriptContext";
import { formatTranscriptTimestampTitle } from "../agentSessionUtils";
import type { TranscriptItem } from "../agentSessionTypes";
import { ToolActivity } from "./ToolActivity";
import { TranscriptTimestamp } from "./TranscriptTimestamp";
import type {
  ActivityRenderClassItemProps,
  AgentTranscriptIdentityProps,
} from "./types";
import { UserMessageBubble } from "./UserMessageBubble";
import { useTranscriptBubbleOverflow } from "./useTranscriptBubbleOverflow";

export function MessageActivity(props: ActivityRenderClassItemProps) {
  if (props.item.type === "tool") {
    return <ToolActivity {...props} />;
  }
  if (props.item.type !== "message") {
    return null;
  }

  return (
    <MessageItem
      agentAvatarUrl={props.agentAvatarUrl}
      agentName={props.agentName}
      agentPubkey={props.agentPubkey}
      item={props.item}
      profiles={props.profiles}
    />
  );
}

function MessageItem({
  agentAvatarUrl,
  agentName,
  agentPubkey,
  item,
  profiles,
}: AgentTranscriptIdentityProps & {
  item: Extract<TranscriptItem, { type: "message" }>;
  profiles?: UserProfileLookup;
}) {
  const variant = useAgentSessionTranscriptVariant();
  const isCompactPreview = variant === "compactPreview";
  const isAssistant = item.role === "assistant";
  const shouldClampBubble = !isCompactPreview;
  const [bubbleRef, hasBubbleOverflow] = useTranscriptBubbleOverflow(
    isAssistant && shouldClampBubble,
  );
  const text = item.text.trim();
  const messageLink = getTranscriptMessageLink(item);

  if (!isAssistant) {
    return (
      <UserMessageBubble
        footer={
          <TranscriptTimestamp
            messageLink={messageLink}
            timestamp={item.timestamp}
          />
        }
        item={item}
        profiles={profiles}
      />
    );
  }

  const agentProfile = profiles?.[normalizePubkey(agentPubkey)] ?? null;
  const agentLabel = resolveUserLabel({
    pubkey: agentPubkey,
    fallbackName: agentName,
    profiles,
    preferResolvedSelfLabel: true,
  });

  // Mirrors the user bubble on the opposite side: the agent's narration reads
  // as its side of the conversation, not as loose prose between tool rows.
  return (
    <div
      className="flex flex-row items-start animate-in fade-in duration-200 motion-reduce:animate-none"
      data-role="assistant-message"
      data-testid="transcript-assistant-message"
    >
      {isCompactPreview ? null : (
        <UserAvatar
          avatarUrl={agentProfile?.avatarUrl ?? agentAvatarUrl}
          className="mr-2 mt-1 size-7 shrink-0 text-xs"
          displayName={agentLabel}
          size="sm"
        />
      )}
      <div className="group relative flex min-w-0 flex-1 flex-col items-start gap-1">
        <div
          className={cn(
            "w-full min-w-0 rounded-2xl border border-border/70 bg-muted/30 p-3 text-sm leading-relaxed text-foreground",
            shouldClampBubble && "relative max-h-36 overflow-hidden",
            isCompactPreview &&
              "border-none bg-transparent p-0 text-xs leading-4",
          )}
          ref={bubbleRef}
          title={formatTranscriptTimestampTitle(item.timestamp)}
        >
          <Markdown
            className={isCompactPreview ? "text-xs leading-4" : "leading-5"}
            content={text || " "}
          />
          {hasBubbleOverflow ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-linear-to-b from-transparent to-background" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getTranscriptMessageLink(
  item: Extract<TranscriptItem, { type: "message" }>,
) {
  if (!item.channelId || !item.messageId) return null;
  return {
    channelId: item.channelId,
    messageId: item.messageId,
  };
}
