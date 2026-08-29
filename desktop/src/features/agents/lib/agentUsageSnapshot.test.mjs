import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTokenFigure,
  formatUsageCost,
  selectLatestAgentUsage,
} from "./agentUsageSnapshot.ts";

function usageEvent(overrides = {}, update = {}) {
  return {
    seq: 1,
    timestamp: "2026-08-29T00:00:00Z",
    kind: "acp_read",
    agentIndex: null,
    channelId: "channel-1",
    sessionId: "session-1",
    turnId: "turn-1",
    payload: {
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "usage_update",
          used: 19_185,
          size: 400_000,
          ...update,
        },
      },
    },
    ...overrides,
  };
}

describe("selectLatestAgentUsage", () => {
  it("returns the newest usage report, not the first", () => {
    const usage = selectLatestAgentUsage([
      usageEvent({ seq: 1 }, { used: 100 }),
      usageEvent({ seq: 2, timestamp: "2026-08-29T00:01:00Z" }, { used: 200 }),
    ]);

    assert.equal(usage?.used, 200);
    assert.equal(usage?.size, 400_000);
    assert.equal(usage?.timestamp, "2026-08-29T00:01:00Z");
  });

  it("carries the cost record through when the harness prices calls", () => {
    const usage = selectLatestAgentUsage([
      usageEvent({}, { cost: { amount: 0.07, currency: "USD" } }),
    ]);

    assert.equal(usage?.costAmount, 0.07);
    assert.equal(usage?.costCurrency, "USD");
  });

  it("skips events that are not usage updates or are malformed", () => {
    const usage = selectLatestAgentUsage([
      usageEvent({}, { used: 500 }),
      usageEvent({ seq: 2 }, { sessionUpdate: "plan" }),
      usageEvent({ seq: 3 }, { used: "not-a-number" }),
      usageEvent({ seq: 4 }, { size: 0, used: 10 }),
      { ...usageEvent({ seq: 5 }), kind: "acp_write" },
    ]);

    assert.equal(usage?.used, 500);
  });

  it("returns null when nothing reported usage", () => {
    assert.equal(selectLatestAgentUsage([]), null);
    assert.equal(
      selectLatestAgentUsage([usageEvent({}, { sessionUpdate: "plan" })]),
      null,
    );
  });
});

describe("formatTokenFigure", () => {
  it("keeps small counts literal and abbreviates the rest", () => {
    assert.equal(formatTokenFigure(812), "812");
    assert.equal(formatTokenFigure(19_185), "19.1k");
    assert.equal(formatTokenFigure(400_000), "400k");
    assert.equal(formatTokenFigure(1_340_000), "1.3M");
  });

  it("truncates rather than rounding up", () => {
    assert.equal(formatTokenFigure(19_999), "19.9k");
  });
});

describe("formatUsageCost", () => {
  it("prints a true zero as $0.00 and keeps sub-cent precision", () => {
    assert.equal(formatUsageCost(0), "$0.00");
    assert.equal(formatUsageCost(0.0042), "$0.0042");
    assert.equal(formatUsageCost(0.07), "$0.07");
    assert.equal(formatUsageCost(1.5), "$1.50");
  });
});
