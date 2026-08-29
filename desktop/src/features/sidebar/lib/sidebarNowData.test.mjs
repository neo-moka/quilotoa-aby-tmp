import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLiveAgentEntries,
  describeFeedItem,
  formatAgentCount,
  formatStartedAt,
  partitionLiveAgents,
  formatCompactAge,
  formatTokenCount,
  localDayBoundsUnix,
  parseTokenField,
  selectNeedsYouRows,
} from "./sidebarNowData.ts";

const KIND_APPROVAL_REQUEST = 46010;
const KIND_JOB_ERROR = 43006;
const KIND_CHANNEL_MESSAGE = 40002;

function feedItem(overrides = {}) {
  return {
    id: "event-1",
    kind: KIND_CHANNEL_MESSAGE,
    pubkey: "a".repeat(64),
    content: "hello",
    createdAt: 1_000,
    channelId: "channel-1",
    channelName: "general",
    tags: [],
    category: "needs_action",
    ...overrides,
  };
}

function turnSummary(overrides = {}) {
  return {
    channelId: "channel-1",
    anchorAt: 1_000,
    agentCount: 1,
    agentPubkeys: ["a".repeat(64)],
    ...overrides,
  };
}

describe("describeFeedItem", () => {
  it("names an approval by its kind", () => {
    assert.equal(
      describeFeedItem({
        kind: KIND_APPROVAL_REQUEST,
        category: "needs_action",
      }),
      "Approval requested",
    );
  });

  it("names a job failure by its kind", () => {
    assert.equal(
      describeFeedItem({ kind: KIND_JOB_ERROR, category: "activity" }),
      "Job failed",
    );
  });

  it("falls back to the category for a plain message", () => {
    assert.equal(
      describeFeedItem({ kind: KIND_CHANNEL_MESSAGE, category: "mention" }),
      "Mention",
    );
    assert.equal(
      describeFeedItem({
        kind: KIND_CHANNEL_MESSAGE,
        category: "agent_activity",
      }),
      "Agent update",
    );
    assert.equal(
      describeFeedItem({ kind: KIND_CHANNEL_MESSAGE, category: "activity" }),
      "Channel update",
    );
  });
});

describe("selectNeedsYouRows", () => {
  it("returns nothing when both buckets are empty", () => {
    const result = selectNeedsYouRows({});
    assert.deepEqual(result.rows, []);
    assert.equal(result.totalCount, 0);
    assert.equal(result.hiddenCount, 0);
  });

  it("sorts approvals above newer non-approvals", () => {
    const result = selectNeedsYouRows({
      needsAction: [
        feedItem({
          id: "old-approval",
          kind: KIND_APPROVAL_REQUEST,
          createdAt: 10,
        }),
      ],
      mentions: [feedItem({ id: "new-mention", createdAt: 900 })],
    });

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["old-approval", "new-mention"],
    );
  });

  it("sorts non-approvals newest first", () => {
    const result = selectNeedsYouRows({
      needsAction: [
        feedItem({ id: "older", createdAt: 10 }),
        feedItem({ id: "newer", createdAt: 20 }),
      ],
    });

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["newer", "older"],
    );
  });

  it("counts an item present in both buckets once", () => {
    const shared = feedItem({ id: "shared", category: "mention" });
    const result = selectNeedsYouRows({
      needsAction: [shared],
      mentions: [shared],
    });

    assert.equal(result.totalCount, 1);
    assert.equal(result.rows.length, 1);
  });

  it("drops items the reader already marked done", () => {
    const result = selectNeedsYouRows({
      needsAction: [feedItem({ id: "handled" }), feedItem({ id: "pending" })],
      doneIds: new Set(["handled"]),
    });

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["pending"],
    );
    assert.equal(result.totalCount, 1);
  });

  it("reports the overflow left off the capped list", () => {
    const result = selectNeedsYouRows({
      needsAction: [
        feedItem({ id: "a", createdAt: 5 }),
        feedItem({ id: "b", createdAt: 4 }),
        feedItem({ id: "c", createdAt: 3 }),
      ],
      limit: 2,
    });

    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["a", "b"],
    );
    assert.equal(result.hiddenCount, 1);
    assert.equal(result.totalCount, 3);
  });

  it("carries the approval flag and channel through to the row", () => {
    const result = selectNeedsYouRows({
      needsAction: [
        feedItem({ kind: KIND_APPROVAL_REQUEST, channelName: "ops" }),
      ],
    });

    assert.equal(result.rows[0].isApproval, true);
    assert.equal(result.rows[0].label, "Approval requested");
    assert.equal(result.rows[0].channelName, "ops");
  });

  it("quotes the first content line as the snippet", () => {
    const result = selectNeedsYouRows({
      needsAction: [
        feedItem({ content: "\n  are we   shipping today?\nsecond line" }),
      ],
    });

    assert.equal(result.rows[0].snippet, "are we shipping today?");
  });

  it("leaves the snippet null for an empty body", () => {
    const result = selectNeedsYouRows({
      needsAction: [feedItem({ content: "  \n \n" })],
    });

    assert.equal(result.rows[0].snippet, null);
  });
});

describe("formatAgentCount", () => {
  it("keeps the unit on zero so it cannot read as an error code", () => {
    assert.equal(formatAgentCount(0), "0 agents");
  });

  it("pluralises on the count", () => {
    assert.equal(formatAgentCount(1), "1 agent");
    assert.equal(formatAgentCount(3), "3 agents");
  });
});

describe("buildLiveAgentEntries", () => {
  const channelNames = new Map([
    ["channel-1", "general"],
    ["channel-2", "engineering"],
  ]);
  const agents = new Map([
    ["a".repeat(64), { name: "Ned", avatarUrl: "https://example.test/n.png" }],
  ]);

  it("emits one entry per agent in a channel", () => {
    const entries = buildLiveAgentEntries({
      summaries: [
        turnSummary({
          agentCount: 2,
          agentPubkeys: ["a".repeat(64), "b".repeat(64)],
        }),
      ],
      channelNameById: channelNames,
      agentsByPubkey: agents,
    });

    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((entry) => entry.agentName),
      ["Ned", null],
    );
  });

  it("keeps one agent working in two channels as two entries", () => {
    const entries = buildLiveAgentEntries({
      summaries: [
        turnSummary({ channelId: "channel-1" }),
        turnSummary({ channelId: "channel-2" }),
      ],
      channelNameById: channelNames,
      agentsByPubkey: agents,
    });

    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((entry) => entry.key)).size, 2);
  });

  it("normalises the pubkey into the key and carries the avatar", () => {
    const entries = buildLiveAgentEntries({
      summaries: [turnSummary({ agentPubkeys: ["A".repeat(64)] })],
      channelNameById: channelNames,
      agentsByPubkey: agents,
    });

    assert.equal(entries[0].key, `${"a".repeat(64)}:channel-1`);
    assert.equal(entries[0].agentName, "Ned");
    assert.equal(entries[0].agentAvatarUrl, "https://example.test/n.png");
  });

  it("drops channels it cannot name", () => {
    const entries = buildLiveAgentEntries({
      summaries: [turnSummary({ channelId: "unknown" })],
      channelNameById: channelNames,
    });

    assert.deepEqual(entries, []);
  });

  it("leaves an unmanaged agent unnamed rather than guessing", () => {
    const entries = buildLiveAgentEntries({
      summaries: [turnSummary({ agentPubkeys: ["c".repeat(64)] })],
      channelNameById: channelNames,
      agentsByPubkey: agents,
    });

    assert.equal(entries[0].agentName, null);
    assert.equal(entries[0].agentAvatarUrl, null);
  });
});

describe("partitionLiveAgents", () => {
  function entry(key, channelId, anchorAt) {
    return {
      key,
      agentPubkey: "a".repeat(64),
      agentName: "Ned",
      agentAvatarUrl: null,
      channelId,
      channelName: channelId,
      anchorAt,
    };
  }

  it("promotes the selected channel above longer-running work", () => {
    const result = partitionLiveAgents(
      [entry("old", "channel-2", 1_000), entry("here", "channel-1", 9_000)],
      { selectedChannelId: "channel-1", cardLimit: 1 },
    );

    assert.deepEqual(
      result.cards.map((row) => row.key),
      ["here"],
    );
    assert.deepEqual(
      result.rows.map((row) => row.key),
      ["old"],
    );
  });

  it("falls back to longest-running when nothing is selected", () => {
    const result = partitionLiveAgents(
      [entry("newer", "channel-2", 9_000), entry("older", "channel-3", 1_000)],
      { selectedChannelId: null, cardLimit: 1 },
    );

    assert.deepEqual(
      result.cards.map((row) => row.key),
      ["older"],
    );
  });

  it("breaks ties on the key so the order cannot flicker", () => {
    const first = partitionLiveAgents(
      [entry("b", "channel-1", 5_000), entry("a", "channel-1", 5_000)],
      { cardLimit: 2 },
    );
    const second = partitionLiveAgents(
      [entry("a", "channel-1", 5_000), entry("b", "channel-1", 5_000)],
      { cardLimit: 2 },
    );

    assert.deepEqual(
      first.cards.map((row) => row.key),
      ["a", "b"],
    );
    assert.deepEqual(
      first.cards.map((row) => row.key),
      second.cards.map((row) => row.key),
    );
  });

  it("reports what neither the cards nor the rows had room for", () => {
    const result = partitionLiveAgents(
      [
        entry("a", "c1", 1),
        entry("b", "c2", 2),
        entry("c", "c3", 3),
        entry("d", "c4", 4),
      ],
      { cardLimit: 1, rowLimit: 1 },
    );

    assert.equal(result.cards.length, 1);
    assert.equal(result.rows.length, 1);
    assert.equal(result.hiddenCount, 2);
  });

  it("does not mutate the entries it was handed", () => {
    const entries = [entry("b", "c1", 9), entry("a", "c1", 1)];
    partitionLiveAgents(entries, { cardLimit: 2 });

    assert.deepEqual(
      entries.map((row) => row.key),
      ["b", "a"],
    );
  });

  it("returns nothing when both limits are zero", () => {
    const result = partitionLiveAgents([entry("a", "c1", 1)], {
      cardLimit: 0,
      rowLimit: 0,
    });

    assert.deepEqual(result.cards, []);
    assert.deepEqual(result.rows, []);
    assert.equal(result.hiddenCount, 1);
  });
});

describe("formatStartedAt", () => {
  it("renders a wall-clock time for the anchor", () => {
    const anchor = new Date(2026, 7, 28, 14, 32, 0).getTime();
    const formatted = formatStartedAt(anchor);

    assert.match(formatted, /\d/);
    assert.ok(formatted.includes("32"));
  });

  it("is stable for the same anchor", () => {
    const anchor = new Date(2026, 7, 28, 9, 5, 0).getTime();
    assert.equal(formatStartedAt(anchor), formatStartedAt(anchor));
  });
});

describe("formatCompactAge", () => {
  const now = 1_000_000_000_000;
  const nowSeconds = Math.floor(now / 1_000);

  it("collapses anything under a minute to 'now'", () => {
    assert.equal(formatCompactAge(nowSeconds, now), "now");
    assert.equal(formatCompactAge(nowSeconds - 59, now), "now");
  });

  it("counts whole minutes, then hours, then days", () => {
    assert.equal(formatCompactAge(nowSeconds - 60, now), "1m");
    assert.equal(formatCompactAge(nowSeconds - 59 * 60, now), "59m");
    assert.equal(formatCompactAge(nowSeconds - 60 * 60, now), "1h");
    assert.equal(formatCompactAge(nowSeconds - 23 * 3_600, now), "23h");
    assert.equal(formatCompactAge(nowSeconds - 24 * 3_600, now), "1d");
    assert.equal(formatCompactAge(nowSeconds - 9 * 24 * 3_600, now), "9d");
  });

  it("treats a clock-skewed future timestamp as 'now'", () => {
    assert.equal(formatCompactAge(nowSeconds + 120, now), "now");
  });
});

describe("localDayBoundsUnix", () => {
  it("spans local midnight to the next local midnight", () => {
    const [start, end] = localDayBoundsUnix(new Date(2026, 7, 28, 13, 45, 30));

    assert.equal(start, Math.floor(new Date(2026, 7, 28).getTime() / 1_000));
    assert.equal(end, Math.floor(new Date(2026, 7, 29).getTime() / 1_000));
  });

  it("rolls the calendar date across a month boundary", () => {
    const [, end] = localDayBoundsUnix(new Date(2026, 7, 31, 23, 59, 59));

    assert.equal(end, Math.floor(new Date(2026, 8, 1).getTime() / 1_000));
  });

  it("stays inside the archive's 48-hour interval ceiling", () => {
    const [start, end] = localDayBoundsUnix(new Date(2026, 2, 8, 12, 0, 0));

    assert.ok(end - start > 0);
    assert.ok(end - start <= 48 * 3_600);
  });
});

describe("parseTokenField", () => {
  it("parses a decimal string into a bigint", () => {
    assert.equal(parseTokenField("18400"), 18_400n);
  });

  it("preserves precision beyond Number.MAX_SAFE_INTEGER", () => {
    assert.equal(parseTokenField("9007199254740993"), 9_007_199_254_740_993n);
  });

  it("rejects anything that is not a non-negative integer", () => {
    assert.equal(parseTokenField(null), null);
    assert.equal(parseTokenField(undefined), null);
    assert.equal(parseTokenField(""), null);
    assert.equal(parseTokenField("-5"), null);
    assert.equal(parseTokenField("1.5"), null);
    assert.equal(parseTokenField("12k"), null);
  });
});

describe("formatTokenCount", () => {
  it("prints small totals exactly", () => {
    assert.equal(formatTokenCount(0n), "0");
    assert.equal(formatTokenCount(842n), "842");
  });

  it("abbreviates thousands to one decimal", () => {
    assert.equal(formatTokenCount(18_400n), "18.4k");
    assert.equal(formatTokenCount(1_000n), "1k");
  });

  it("abbreviates millions to one decimal", () => {
    assert.equal(formatTokenCount(1_250_000n), "1.2M");
    assert.equal(formatTokenCount(2_000_000n), "2M");
  });

  it("truncates rather than rounding up a partial tenth", () => {
    assert.equal(formatTokenCount(18_499n), "18.4k");
  });
});
