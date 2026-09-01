import * as React from "react";

import {
  type AgentSignalSplit,
  splitAgentSignalReactions,
} from "@/features/messages/lib/agentSignalReactions";
import type { TimelineReaction } from "@/features/messages/types";

/**
 * Splits agent lifecycle signals (👀 seen / 💬 working) out of a message's
 * reactions so every timeline surface renders them the same way: human chips
 * stay chips, agent votes become the WhatsApp-style `AgentSignalStatusLine`.
 *
 * Owns the staleness clock: the tick only advances when a working signal is
 * due to cross the cutoff, so an orphaned 💬 (agent restarted mid-turn)
 * demotes itself to "seen" without user interaction — and idle rows never
 * tick.
 */
export function useAgentSignalSplit(
  reactions: TimelineReaction[] | undefined,
  isAgentPubkey: (pubkey: string) => boolean,
): AgentSignalSplit {
  const [signalClockMs, setSignalClockMs] = React.useState(() => Date.now());
  const split = React.useMemo(
    () => splitAgentSignalReactions(reactions, isAgentPubkey, signalClockMs),
    [isAgentPubkey, reactions, signalClockMs],
  );
  React.useEffect(() => {
    if (split.workingExpiresAtMs === null) return;
    const delay = Math.max(0, split.workingExpiresAtMs - Date.now()) + 1_000;
    const timer = window.setTimeout(() => setSignalClockMs(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [split.workingExpiresAtMs]);
  return split;
}
