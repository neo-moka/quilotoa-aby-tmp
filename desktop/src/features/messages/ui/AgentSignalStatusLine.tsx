import { CheckCheck } from "lucide-react";

import {
  type AgentSignalUser,
  formatAgentSignalNames,
} from "@/features/messages/lib/agentSignalReactions";
import { Spinner } from "@/shared/ui/spinner";

/**
 * WhatsApp-style footer for the agent lifecycle signals split out of the
 * reaction chips: a spinning "working on this…" line while a 💬 is live,
 * otherwise a quiet "Seen by …" tick line for held 👀 votes.
 */
export function AgentSignalStatusLine({
  seenByAgents,
  workingAgents,
}: {
  seenByAgents: AgentSignalUser[];
  workingAgents: AgentSignalUser[];
}) {
  if (workingAgents.length > 0) {
    return (
      <p
        className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
        data-testid="agent-working-status"
      >
        <Spinner aria-hidden className="size-3 border-2 text-primary" />
        <span className="min-w-0 truncate">
          {formatAgentSignalNames(workingAgents)}
          {workingAgents.length === 1 ? " is" : " are"} working on this…
        </span>
      </p>
    );
  }
  if (seenByAgents.length === 0) return null;
  return (
    <p
      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80"
      data-testid="agent-seen-status"
      title={`Seen by ${formatAgentSignalNames(seenByAgents)}`}
    >
      <CheckCheck aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">
        Seen by {formatAgentSignalNames(seenByAgents)}
      </span>
    </p>
  );
}
