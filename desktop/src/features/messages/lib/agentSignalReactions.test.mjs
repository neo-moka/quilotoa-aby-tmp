import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAgentSignalNames,
  splitAgentSignalReactions,
  STALE_WORKING_AFTER_MS,
} from "./agentSignalReactions.ts";

const AGENT_A = "a".repeat(64);
const AGENT_B = "b".repeat(64);
const HUMAN = "c".repeat(64);

const isAgent = (pubkey) => pubkey === AGENT_A || pubkey === AGENT_B;
const NOW_MS = 1_700_000_000_000;

function reaction(emoji, users, extra = {}) {
  return {
    emoji,
    count: users.length,
    users: users.map(([pubkey, displayName]) => ({
      pubkey,
      displayName,
      avatarUrl: null,
    })),
    ...extra,
  };
}

test("agent 👀 and 💬 votes leave the chips and land in signal buckets", () => {
  const split = splitAgentSignalReactions(
    [
      reaction("👀", [
        [AGENT_A, "Aby"],
        [AGENT_B, "Jeny"],
      ]),
      reaction("💬", [[AGENT_A, "Aby"]]),
      reaction("🔥", [[HUMAN, "Ronald"]]),
    ],
    isAgent,
    NOW_MS,
  );

  assert.deepEqual(
    split.seenByAgents.map((u) => u.displayName),
    ["Aby", "Jeny"],
  );
  assert.deepEqual(
    split.workingAgents.map((u) => u.displayName),
    ["Aby"],
  );
  assert.deepEqual(
    split.humanReactions.map((r) => r.emoji),
    ["🔥"],
  );
});

test("a human 👀 keeps its chip with the agent votes subtracted", () => {
  const split = splitAgentSignalReactions(
    [
      reaction("👀", [
        [AGENT_A, "Aby"],
        [HUMAN, "Ronald"],
      ]),
    ],
    isAgent,
    NOW_MS,
  );

  assert.equal(split.humanReactions.length, 1);
  assert.equal(split.humanReactions[0].count, 1);
  assert.deepEqual(
    split.humanReactions[0].users.map((u) => u.displayName),
    ["Ronald"],
  );
  assert.deepEqual(
    split.seenByAgents.map((u) => u.displayName),
    ["Aby"],
  );
});

test("custom-image emoji sharing the glyph are not treated as signals", () => {
  const split = splitAgentSignalReactions(
    [
      reaction("💬", [[AGENT_A, "Aby"]], {
        emojiUrl: "https://relay.example/emoji.png",
      }),
    ],
    isAgent,
    NOW_MS,
  );

  assert.equal(split.workingAgents.length, 0);
  assert.equal(split.humanReactions.length, 1);
});

test("untouched reaction lists keep their identity for memoized rows", () => {
  const input = [reaction("🔥", [[HUMAN, "Ronald"]])];
  const split = splitAgentSignalReactions(input, isAgent, NOW_MS);
  assert.equal(split.humanReactions, input);

  const empty = splitAgentSignalReactions(undefined, isAgent, NOW_MS);
  assert.equal(empty.humanReactions, undefined);
  assert.deepEqual(empty.seenByAgents, []);
});

test("name formatting stays short past three agents", () => {
  const users = [
    { pubkey: "1", displayName: "Aby" },
    { pubkey: "2", displayName: "Jeny" },
    { pubkey: "3", displayName: "Francisco" },
    { pubkey: "4", displayName: "Fizz" },
  ];
  assert.equal(formatAgentSignalNames(users.slice(0, 1)), "Aby");
  assert.equal(formatAgentSignalNames(users.slice(0, 2)), "Aby and Jeny");
  assert.equal(
    formatAgentSignalNames(users.slice(0, 3)),
    "Aby, Jeny and Francisco",
  );
  assert.equal(formatAgentSignalNames(users), "Aby, Jeny +2");
});

test("an orphaned 💬 past the cutoff demotes to seen, live ones stay working", () => {
  const nowSeconds = Math.floor(NOW_MS / 1_000);
  const staleAt = nowSeconds - Math.floor(STALE_WORKING_AFTER_MS / 1_000) - 60;
  const freshAt = nowSeconds - 30;
  const split = splitAgentSignalReactions(
    [
      {
        emoji: "💬",
        count: 2,
        users: [
          {
            pubkey: AGENT_A,
            displayName: "Aby",
            avatarUrl: null,
            createdAt: staleAt,
          },
          {
            pubkey: AGENT_B,
            displayName: "Jeny",
            avatarUrl: null,
            createdAt: freshAt,
          },
        ],
      },
    ],
    isAgent,
    NOW_MS,
  );

  assert.deepEqual(
    split.workingAgents.map((u) => u.displayName),
    ["Jeny"],
  );
  assert.deepEqual(
    split.seenByAgents.map((u) => u.displayName),
    ["Aby"],
  );
  assert.equal(
    split.workingExpiresAtMs,
    freshAt * 1_000 + STALE_WORKING_AFTER_MS,
  );
});

test("working votes without timestamps never expire", () => {
  const split = splitAgentSignalReactions(
    [
      {
        emoji: "💬",
        count: 1,
        users: [{ pubkey: AGENT_A, displayName: "Aby", avatarUrl: null }],
      },
    ],
    isAgent,
    NOW_MS,
  );
  assert.deepEqual(
    split.workingAgents.map((u) => u.displayName),
    ["Aby"],
  );
  assert.equal(split.workingExpiresAtMs, null);
});
