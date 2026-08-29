import type { ObserverEvent } from "@/features/agents/ui/agentSessionTypes";

/**
 * The most recent context-usage report an agent's observer stream carried.
 *
 * ACP harnesses emit `usage_update` session updates with the tokens used
 * against the context window (`used`/`size`) and, when the harness prices its
 * calls, a cost record. This is the same event the transcript renders as its
 * "Usage" row — so the run header quoting it can never disagree with the
 * transcript below it.
 *
 * What this is NOT: a per-run spend total. `used` is context fill, which can
 * shrink on compaction; `cost` is whatever the harness last reported. Both are
 * quoted as "latest report", never summed.
 */
export type AgentUsageSnapshot = {
  used: number;
  size: number;
  costAmount: number | null;
  costCurrency: string | null;
  /** Timestamp of the report, so a stale figure can say when it was true. */
  timestamp: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Scan an agent's observer events, newest first, for the latest usage report.
 *
 * Mirrors the transcript's parsing of `session/update` → `usage_update`
 * (`agentSessionTranscript.ts`) — if the two ever read the payload
 * differently, the header and the transcript would show different numbers for
 * the same event.
 */
export function selectLatestAgentUsage(
  events: readonly ObserverEvent[],
): AgentUsageSnapshot | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind !== "acp_read") continue;
    const payload = asRecord(event.payload);
    if (payload.method !== "session/update") continue;
    const update = asRecord(asRecord(payload.params).update);
    if (update.sessionUpdate !== "usage_update") continue;

    const used = typeof update.used === "number" ? update.used : null;
    const size = typeof update.size === "number" ? update.size : null;
    if (used === null || size === null || size <= 0) continue;

    const cost = asRecord(update.cost);
    return {
      used,
      size,
      costAmount: typeof cost.amount === "number" ? cost.amount : null,
      costCurrency: typeof cost.currency === "string" ? cost.currency : null,
      timestamp: event.timestamp,
    };
  }
  return null;
}

/**
 * A token count in the width a vitals tile has for it: `812`, `19.2k`, `1.3M`.
 * Truncates rather than rounds so the figure never overstates what was spent.
 */
export function formatTokenFigure(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1_000) return String(Math.floor(count));

  const scale =
    count < 1_000_000
      ? { divisor: 1_000, suffix: "k" }
      : { divisor: 1_000_000, suffix: "M" };
  const tenths = Math.floor((count / scale.divisor) * 10) / 10;
  return `${Number.isInteger(tenths) ? tenths.toFixed(0) : tenths.toFixed(1)}${scale.suffix}`;
}

/**
 * A reported cost, honest at both ends of the range: a true zero prints as
 * `$0.00` and a sub-cent figure keeps enough decimals not to read as zero.
 */
export function formatUsageCost(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "$0.00";
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
