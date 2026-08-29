import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAgentRunSummaries,
  formatAgentRunStatusLine,
  formatRunChannelLabel,
} from "./agentRunSummaries.ts";

const ALICE =
  "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";
const BOB = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";
const CARLA =
  "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333";

const NAMES = {
  "chan-eng": "product-eng",
  "chan-design": "design",
};

const channelNameFor = (id) => NAMES[id] ?? null;

function agent(pubkey, name, avatarUrl = null) {
  return { pubkey, name, avatarUrl };
}

describe("buildAgentRunSummaries", () => {
  it("splits the roster into working and standing by", () => {
    const { working, standingBy } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice"), agent(BOB, "Bob")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 1000, agentPubkeys: [ALICE] },
      ],
      channelNameFor,
    });

    assert.deepEqual(
      working.map((run) => run.pubkey),
      [ALICE],
    );
    assert.deepEqual(
      standingBy.map((run) => run.pubkey),
      [BOB],
    );
    assert.equal(working[0].startedAt, 1000);
    assert.equal(standingBy[0].startedAt, null);
  });

  it("resolves channel names and keeps the channel id", () => {
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 1000, agentPubkeys: [ALICE] },
      ],
      channelNameFor,
    });

    assert.deepEqual(working[0].channels, [
      {
        channelId: "chan-eng",
        channelName: "product-eng",
        anchorAt: 1000,
        isDm: false,
      },
    ]);
  });

  it("leaves channelName null when the channel list has not loaded", () => {
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice")],
      activeChannelTurns: [
        { channelId: "chan-unknown", anchorAt: 1000, agentPubkeys: [ALICE] },
      ],
      channelNameFor,
    });

    assert.equal(working[0].channels[0].channelName, null);
  });

  it("anchors a multi-channel run to its earliest turn", () => {
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice")],
      activeChannelTurns: [
        { channelId: "chan-design", anchorAt: 5000, agentPubkeys: [ALICE] },
        { channelId: "chan-eng", anchorAt: 2000, agentPubkeys: [ALICE] },
      ],
      channelNameFor,
    });

    assert.equal(working[0].startedAt, 2000);
    assert.deepEqual(
      working[0].channels.map((channel) => channel.channelId),
      ["chan-eng", "chan-design"],
    );
  });

  it("orders working runs longest-first", () => {
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice"), agent(BOB, "Bob"), agent(CARLA, "Carla")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 9000, agentPubkeys: [ALICE] },
        { channelId: "chan-design", anchorAt: 1000, agentPubkeys: [CARLA] },
      ],
      channelNameFor,
    });

    assert.deepEqual(
      working.map((run) => run.name),
      ["Carla", "Alice"],
    );
  });

  it("orders standing-by runs by name", () => {
    const { standingBy } = buildAgentRunSummaries({
      agents: [agent(CARLA, "Carla"), agent(ALICE, "Alice"), agent(BOB, "Bob")],
      activeChannelTurns: [],
      channelNameFor,
    });

    assert.deepEqual(
      standingBy.map((run) => run.name),
      ["Alice", "Bob", "Carla"],
    );
  });

  it("matches turn pubkeys case-insensitively", () => {
    // The turn store normalizes; the roster carries whatever the backend wrote.
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE.toUpperCase(), "Alice")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 1000, agentPubkeys: [ALICE] },
      ],
      channelNameFor,
    });

    assert.equal(working.length, 1);
    // The roster's spelling is preserved for the caller's own lookups.
    assert.equal(working[0].pubkey, ALICE.toUpperCase());
  });

  it("drops turns whose agent is not on the roster", () => {
    const { working, standingBy } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 1000, agentPubkeys: [BOB] },
      ],
      channelNameFor,
    });

    assert.deepEqual(working, []);
    assert.deepEqual(
      standingBy.map((run) => run.pubkey),
      [ALICE],
    );
  });

  it("counts a duplicated roster entry once", () => {
    const { standingBy } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice"), agent(ALICE.toUpperCase(), "Alice")],
      activeChannelTurns: [],
      channelNameFor,
    });

    assert.equal(standingBy.length, 1);
  });

  it("puts every agent sharing a channel in the working list", () => {
    const { working } = buildAgentRunSummaries({
      agents: [agent(ALICE, "Alice"), agent(BOB, "Bob")],
      activeChannelTurns: [
        { channelId: "chan-eng", anchorAt: 1000, agentPubkeys: [ALICE, BOB] },
      ],
      channelNameFor,
    });

    assert.deepEqual(
      working.map((run) => run.name),
      ["Alice", "Bob"],
    );
  });
});

describe("formatRunChannelLabel", () => {
  it("returns null with no channels", () => {
    assert.equal(formatRunChannelLabel([]), null);
  });

  it("names a single channel", () => {
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: "product-eng", anchorAt: 0 },
      ]),
      "#product-eng",
    );
  });

  it("degrades an unnamed single channel rather than showing its id", () => {
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: null, anchorAt: 0 },
      ]),
      "a channel",
    );
  });

  it("shows the first name plus a count for several channels", () => {
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: "product-eng", anchorAt: 0 },
        { channelId: "b", channelName: "design", anchorAt: 1 },
        { channelId: "c", channelName: "sales", anchorAt: 2 },
      ]),
      "#product-eng +2",
    );
  });

  it("counts channels when none of them has a name yet", () => {
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: null, anchorAt: 0 },
        { channelId: "b", channelName: null, anchorAt: 1 },
      ]),
      "2 channels",
    );
  });

  it("names a DM as a DM, never as a hash channel", () => {
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: "DM", anchorAt: 0, isDm: true },
      ]),
      "a DM",
    );
    assert.equal(
      formatRunChannelLabel([
        { channelId: "a", channelName: "DM", anchorAt: 0, isDm: true },
        { channelId: "b", channelName: "design", anchorAt: 1 },
      ]),
      "a DM +1",
    );
  });
});

describe("formatAgentRunStatusLine", () => {
  it("reads as idle with no channels", () => {
    assert.equal(
      formatAgentRunStatusLine({ channels: [], elapsedLabel: "4m 0s" }),
      "Idle",
    );
  });

  it("names the channel and the duration", () => {
    assert.equal(
      formatAgentRunStatusLine({
        channels: [{ channelId: "a", channelName: "product-eng", anchorAt: 0 }],
        elapsedLabel: "4m 12s",
      }),
      "Working in #product-eng for 4m 12s",
    );
  });

  it("drops the duration clause when there is no clock to show", () => {
    assert.equal(
      formatAgentRunStatusLine({
        channels: [{ channelId: "a", channelName: "product-eng", anchorAt: 0 }],
        elapsedLabel: null,
      }),
      "Working in #product-eng",
    );
  });
});
