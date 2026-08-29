import type { ActivityRowStats } from "./activityRenderClasses/ActivityRow";
import type { FileEditDiff } from "./agentSessionFileEditDiff";
import { buildCompactToolSummary } from "./agentSessionToolSummary";
import { hasFileEditLineDiff } from "./FileEditDiffView";
import type { TranscriptItem } from "./agentSessionTypes";

/**
 * The per-file diffs inside a tool burst, for the summary row's `+N −M`.
 * Errored calls are skipped: a failed edit changed nothing worth counting.
 */
export function getGroupedFileEditDiffs(
  items: TranscriptItem[],
): FileEditDiff[] {
  return items.flatMap((item) => {
    if (item.type !== "tool" || item.isError) {
      return [];
    }

    const diff = buildCompactToolSummary(item).fileEditDiff;
    return diff && hasFileEditLineDiff(diff) ? [diff] : [];
  });
}

/** Total the burst's diffs, or `null` so an empty burst shows no stats. */
export function summarizeFileEditDiffs(
  diffs: FileEditDiff[],
): ActivityRowStats | null {
  if (diffs.length === 0) {
    return null;
  }

  return diffs.reduce(
    (stats, diff) => ({
      additions: stats.additions + diff.additions,
      deletions: stats.deletions + diff.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
}
