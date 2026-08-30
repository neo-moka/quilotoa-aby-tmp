import type * as React from "react";

import { UserProfilePopover } from "@/features/profile/ui/UserProfilePopover";
import { cn } from "@/shared/lib/cn";
import { InlineChip } from "@/shared/ui/InlineChip";
import { useMarkdownRuntime } from "./runtimeContext";

/**
 * An `@mention` chip in rendered message markdown.
 *
 * Resolution comes from the per-mount runtime (names → pubkeys): agent
 * mentions carry the bot glyph, and only a mention that resolves to the
 * viewer (`selfPubkey`) gets the opaque highlighter treatment — see
 * `markdown.css`. Unresolved mentions stay plain, non-clickable chips.
 */
export function MarkdownMention({
  children,
  interactive,
}: {
  children?: React.ReactNode;
  interactive: boolean;
}) {
  const { agentMentionPubkeysByName, mentionPubkeysByName, selfPubkey } =
    useMarkdownRuntime();
  const mentionText = String(children ?? "");
  const mentionName = mentionText.replace(/^@/, "").trim().toLowerCase();
  const pubkey = mentionPubkeysByName?.[mentionName];
  const isAgentMention =
    pubkey !== undefined && agentMentionPubkeysByName?.[mentionName] === pubkey;
  const isSelfMention =
    pubkey !== undefined &&
    typeof selfPubkey === "string" &&
    pubkey.toLowerCase() === selfPubkey.toLowerCase();
  const mentionLabel = mentionText.replace(/^@/, "");
  // Only chips that actually open a profile get the clickable affordance.
  // A mention whose pubkey didn't resolve stays a plain chip — a pointer
  // cursor there promises a click that does nothing.
  const opensProfile = interactive && pubkey !== undefined;
  const mentionNode = (
    <InlineChip
      data-mention=""
      className={cn(
        isAgentMention && "agent-mention-highlight",
        isSelfMention && "mention-self",
      )}
      icon={isAgentMention ? "agent" : "human"}
      interactive={opensProfile}
    >
      {mentionLabel}
    </InlineChip>
  );

  return opensProfile ? (
    <UserProfilePopover
      botIdenticonValue={mentionLabel}
      pubkey={pubkey}
      role={isAgentMention ? "bot" : undefined}
      triggerElement="span"
    >
      {mentionNode}
    </UserProfilePopover>
  ) : (
    mentionNode
  );
}
