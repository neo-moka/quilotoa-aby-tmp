import type { TranscriptItem } from "./agentSessionTypes";

/**
 * Lifecycle rows the polished transcript no longer prints.
 *
 * `Usage` and `Commands` are telemetry about the harness, not activity by the
 * agent: token counters repeat after every turn and the command tally never
 * changes mid-session, so together they were most of the visual noise in a
 * short conversation — and the activity panel's header now quotes the same
 * usage stream live, making the rows a stale duplicate two inches below the
 * tile. They stay in the raw rail, which exists precisely for this layer.
 *
 * Matched on the lifecycle *title* because that is the one stable identity
 * these coalesced rows have — the builder keys them `usage:…`/`commands:…`
 * but the key never reaches the item.
 */
const TELEMETRY_TITLES = new Set(["Usage", "Commands"]);

export function isTranscriptTelemetryItem(item: TranscriptItem): boolean {
  return item.type === "lifecycle" && TELEMETRY_TITLES.has(item.title);
}

/** The polished transcript: everything except telemetry rows. */
export function selectPolishedTranscriptItems(
  items: readonly TranscriptItem[],
): TranscriptItem[] {
  return items.filter((item) => !isTranscriptTelemetryItem(item));
}
