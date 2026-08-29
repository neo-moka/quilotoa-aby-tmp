import * as React from "react";
import { Activity } from "lucide-react";

import { resolveAgentMessageProvenance } from "@/features/messages/lib/agentMessageProvenance";
import type { TimelineMessage } from "@/features/messages/types";
import { useAgentSession } from "@/shared/context/AgentSessionContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { MessageAgentOwner } from "./MessageAgentOwner";

/**
 * The provenance segment of an agent's message header: the existing "managed
 * by" chip, plus a way into the run that produced the message.
 *
 * It wraps `MessageAgentOwner` rather than sitting beside it as a second
 * header segment on purpose. The row already marks agent authorship once (bot
 * glyph, owner attribution); a separate agent badge next to it would say the
 * same thing twice and read as two different claims. So the affordance joins
 * the marker that exists instead of competing with it — one chip, one divider
 * slot in `MessageMetaSegments`.
 *
 * Nothing here reports what the run *did* — no step count, duration, or cost.
 * The timeline carries none of those, and a per-row placeholder repeated down
 * a conversation costs more attention than it returns.
 *
 * Returns null for a human author, but the call site still gates on
 * `isAgent` before mounting it: `MessageMetaSegments` decides where to put a
 * divider by testing each segment's node for truthiness, and an element that
 * renders nothing is still truthy — so mounting this unconditionally would
 * punctuate every human header as "Alice · 9:53 AM".
 *
 * Reads the channel's session handler from context rather than taking it as a
 * prop: `ChannelScreen` already publishes one through `AgentSessionProvider`,
 * and threading a callback down to the row would mean growing `ChannelPane`,
 * which has no room. Off a channel screen the context is empty and the
 * affordance simply does not render.
 */
export function AgentMessageProvenance({
  channelId,
  message,
}: {
  channelId?: string | null;
  message: TimelineMessage;
}) {
  const { onOpenAgentSession } = useAgentSession();
  const pubkey = message.pubkey ?? null;
  const handleOpenActivity = React.useCallback(() => {
    if (!pubkey) return;
    // Scoped to this channel, so the pane opens on the run that produced the
    // message the reader clicked from — not the agent's latest run elsewhere.
    onOpenAgentSession?.(pubkey, channelId);
  }, [channelId, onOpenAgentSession, pubkey]);

  const provenance = resolveAgentMessageProvenance({
    author: message.author,
    canOpenActivity: onOpenAgentSession !== null,
    isAgent: message.isAgent,
    ownerLabel: message.ownerLabel,
    ownerPubkey: message.ownerPubkey,
    pubkey,
  });
  if (!provenance) {
    return null;
  }

  return (
    <span
      className="inline-flex min-w-0 items-baseline gap-1"
      data-testid="agent-message-provenance"
    >
      <MessageAgentOwner
        ownerLabel={provenance.ownerLabel}
        ownerPubkey={provenance.ownerPubkey}
      />
      {provenance.activityPubkey ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={provenance.activityLabel}
              // `self-center` for the same reason the owner chip's glyph uses
              // it: an icon-only control has no text baseline of its own, so
              // baseline alignment would hang it off the box edge.
              className="shrink-0 self-center rounded text-muted-foreground/65 transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="agent-message-provenance-activity"
              onClick={handleOpenActivity}
              type="button"
            >
              <Activity aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{provenance.activityLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
